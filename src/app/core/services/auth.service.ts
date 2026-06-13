import { EnvironmentInjector, Injectable, inject, runInInjectionContext, signal } from '@angular/core';
import { AppCheck } from '@angular/fire/app-check';
import {
  Auth,
  User,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
} from '@angular/fire/auth';
import { ensureAppCheckReady } from '../utils/app-check.utils';
import { isIosStandalonePwa } from '../utils/platform.utils';
import {
  Firestore,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { resolveCountryCode } from '../config/country-profiles.config';
import { AppUser, UserRole } from '../models/user.model';
import { InviteCodeService } from './invite-code.service';
import { canManageTenants } from '../utils/role.utils';

const AUTH_LISTENER_TIMEOUT_MS = 10000;
const LOGIN_TIMEOUT_MS = 20000;
const PROFILE_RETRY_DELAY_MS = 600;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private appCheck = inject(AppCheck, { optional: true });
  private firestore = inject(Firestore);
  private injector = inject(EnvironmentInjector);
  private inviteCodeService = inject(InviteCodeService);

  readonly currentUser = signal<AppUser | null>(null);
  readonly firebaseUser = signal<User | null>(null);
  readonly loading = signal(true);
  readonly emailVerified = signal(false);

  constructor() {
    window.setTimeout(() => {
      if (this.loading()) {
        this.loading.set(false);
      }
    }, AUTH_LISTENER_TIMEOUT_MS);

    onAuthStateChanged(this.auth, async (user) => {
      this.loading.set(true);
      this.firebaseUser.set(user);
      this.emailVerified.set(!!user?.emailVerified);
      try {
        if (user) {
          await this.loadUserProfile(user.uid);
        } else {
          this.currentUser.set(null);
        }
      } catch {
        this.currentUser.set(null);
      } finally {
        this.loading.set(false);
      }
    });
  }

  /** Wait until Firebase auth and the Firestore user profile are in sync. */
  waitForSession(timeoutMs = 8000): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const started = Date.now();
      const tick = () => {
        if (this.isSessionSettled()) {
          resolve(this.isAuthenticated());
          return;
        }
        if (Date.now() - started > timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  isSessionSettled(): boolean {
    if (this.loading()) {
      return false;
    }
    const firebaseUser = this.firebaseUser() ?? this.auth.currentUser;
    if (firebaseUser && !this.currentUser()) {
      return false;
    }
    return true;
  }

  isAuthenticated(): boolean {
    const firebaseUser = this.firebaseUser() ?? this.auth.currentUser;
    return !!firebaseUser && !!this.currentUser() && this.emailVerified();
  }

  async register(
    email: string,
    password: string,
    name: string,
    phone: string,
    role: UserRole = 'owner',
    _options?: { inviteCode?: string; unitId?: string; countryCode?: string }
  ): Promise<void> {
    await ensureAppCheckReady(this.appCheck ?? null);

    let credential;
    try {
      credential = await createUserWithEmailAndPassword(this.auth, email, password);
    } catch (err) {
      throw this.enrichRegisterError(err);
    }

    try {
      await updateFirebaseProfile(credential.user, { displayName: name });
      await sendEmailVerification(credential.user);

      const countryCode = resolveCountryCode(_options?.countryCode);

      const appUser: Omit<AppUser, 'id'> = {
        name,
        phone,
        email,
        role,
        countryCode,
        createdAt: new Date(),
      };

      await setDoc(doc(this.firestore, 'users', credential.user.uid), {
        ...appUser,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      // Roll back the half-created auth account so the email can be reused.
      await deleteUser(credential.user).catch(() => undefined);
      throw this.enrichRegisterError(err);
    }

    if (canManageTenants(role)) {
      try {
        await this.inviteCodeService.ensureOwnerCode(credential.user.uid, name);
      } catch {
        // Non-fatal: the owner invite code is generated lazily later if this fails.
      }
    }

    await signOut(this.auth);
    this.currentUser.set(null);
    this.firebaseUser.set(null);
    this.emailVerified.set(false);
  }

  async linkWithInviteCode(userId: string, inviteCode: string) {
    const result = await this.inviteCodeService.redeem(inviteCode, userId);
    await this.loadUserProfile(userId);
    return result;
  }

  async login(email: string, password: string): Promise<void> {
    await ensureAppCheckReady(this.appCheck ?? null);

    let credential;
    try {
      credential = await this.withTimeout(
        signInWithEmailAndPassword(this.auth, email, password),
        LOGIN_TIMEOUT_MS,
        'Sign-in timed out. Check your connection and try again.'
      );
    } catch (err) {
      throw this.enrichAuthError(err);
    }

    this.firebaseUser.set(credential.user);

    try {
      await credential.user.reload();
    } catch {
      // reload() can fail on some browsers (e.g. Safari with strict privacy); use cached user
    }

    this.emailVerified.set(credential.user.emailVerified);

    if (!credential.user.emailVerified) {
      await signOut(this.auth);
      throw new Error('Please verify your email before signing in. Check your inbox for the verification link.');
    }

    try {
      await this.loadUserProfile(credential.user.uid, true);
    } catch {
      throw new Error('Signed in but could not load your profile. Check your connection and try again.');
    }

    if (!this.currentUser()) {
      throw new Error('No account profile found. Contact support if this continues.');
    }
  }

  async resendVerificationEmail(email: string, password: string): Promise<void> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    await sendEmailVerification(credential.user);
    await signOut(this.auth);
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  async updateCountry(countryCode: string): Promise<void> {
    const firebaseUser = this.firebaseUser();
    const appUser = this.currentUser();
    if (!firebaseUser || !appUser) {
      throw new Error('Not signed in');
    }

    const resolved = resolveCountryCode(countryCode);
    await this.runFirestore((db) =>
      updateDoc(doc(db, 'users', firebaseUser.uid), {
        countryCode: resolved,
      }),
    );

    this.currentUser.set({
      ...appUser,
      countryCode: resolved,
    });
  }

  async updateProfile(updates: { name: string; phone: string }): Promise<void> {
    const firebaseUser = this.firebaseUser();
    const appUser = this.currentUser();
    if (!firebaseUser || !appUser) {
      throw new Error('Not signed in');
    }

    await updateFirebaseProfile(firebaseUser, { displayName: updates.name });
    await this.runFirestore((db) =>
      updateDoc(doc(db, 'users', firebaseUser.uid), {
        name: updates.name,
        phone: updates.phone,
      }),
    );

    this.currentUser.set({
      ...appUser,
      name: updates.name,
      phone: updates.phone,
    });
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    this.currentUser.set(null);
    this.emailVerified.set(false);
  }

  private async loadUserProfile(uid: string, retryOnFailure = false): Promise<void> {
    try {
      const snap = await getDoc(doc(this.firestore, 'users', uid));
      if (!snap.exists()) {
        this.currentUser.set(null);
        return;
      }

      const data = snap.data();
      this.currentUser.set({
        id: uid,
        name: data['name'] ?? '',
        phone: data['phone'] ?? '',
        email: data['email'] ?? '',
        role: data['role'] ?? 'owner',
        countryCode: data['countryCode'] ? resolveCountryCode(data['countryCode']) : undefined,
        photoUrl: data['photoUrl'],
        linkedOwnerId: data['linkedOwnerId'],
        linkedPropertyId: data['linkedPropertyId'],
        tenantRecordId: data['tenantRecordId'],
        createdAt: data['createdAt']?.toDate?.() ?? new Date(),
      });
    } catch (err) {
      if (retryOnFailure) {
        await new Promise((resolve) => window.setTimeout(resolve, PROFILE_RETRY_DELAY_MS));
        const snap = await getDoc(doc(this.firestore, 'users', uid));
        if (!snap.exists()) {
          this.currentUser.set(null);
          return;
        }

        const data = snap.data();
        this.currentUser.set({
          id: uid,
          name: data['name'] ?? '',
          phone: data['phone'] ?? '',
          email: data['email'] ?? '',
          role: data['role'] ?? 'owner',
          countryCode: data['countryCode'] ? resolveCountryCode(data['countryCode']) : undefined,
          photoUrl: data['photoUrl'],
          linkedOwnerId: data['linkedOwnerId'],
          linkedPropertyId: data['linkedPropertyId'],
          tenantRecordId: data['tenantRecordId'],
          createdAt: data['createdAt']?.toDate?.() ?? new Date(),
        });
        return;
      }

      throw err;
    }
  }

  private runFirestore<T>(fn: (db: Firestore) => T | Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, () => Promise.resolve(fn(this.firestore)));
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      promise
        .then((value) => {
          window.clearTimeout(timer);
          resolve(value);
        })
        .catch((err) => {
          window.clearTimeout(timer);
          reject(err);
        });
    });
  }

  private enrichRegisterError(err: unknown): Error {
    const code = (err as { code?: string })?.code;

    if (code === 'auth/email-already-in-use') {
      return new Error('That email is already registered. Try signing in instead.');
    }

    if (code === 'auth/network-request-failed' || code === 'unavailable' || this.looksBlocked(err)) {
      return new Error(
        'Could not reach the server. A browser ad blocker or privacy extension is likely blocking Firestore — disable it for this site (or try a different browser / a private window with extensions off) and try again.'
      );
    }

    if (code === 'permission-denied') {
      return new Error('Account creation was blocked by security rules. Make sure the latest rules are deployed, then try again.');
    }

    return err instanceof Error ? err : new Error('Could not create account. Please try again.');
  }

  /** Detect ad blocker / privacy-extension network blocks (ERR_BLOCKED_BY_CLIENT). */
  private looksBlocked(err: unknown): boolean {
    const message = (err as { message?: string })?.message ?? '';
    return /blocked_by_client|err_blocked|network|failed to fetch/i.test(message);
  }

  private enrichAuthError(err: unknown): Error {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/network-request-failed' && isIosStandalonePwa()) {
      return new Error(
        'Connection failed in the home-screen app. Close RentBook, open it once in Safari to sign in, then try the home-screen icon again.'
      );
    }

    return err instanceof Error ? err : new Error('Could not sign in. Please try again.');
  }
}
