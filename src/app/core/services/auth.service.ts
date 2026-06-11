import { Injectable, inject, signal } from '@angular/core';
import {
  Auth,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { AppUser, UserRole } from '../models/user.model';
import { InviteCodeService } from './invite-code.service';
import { canManageTenants } from '../utils/role.utils';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private inviteCodeService = inject(InviteCodeService);

  readonly currentUser = signal<AppUser | null>(null);
  readonly firebaseUser = signal<User | null>(null);
  readonly loading = signal(true);
  readonly emailVerified = signal(false);

  constructor() {
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
    _options?: { inviteCode?: string; unitId?: string }
  ): Promise<void> {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    await updateFirebaseProfile(credential.user, { displayName: name });
    await sendEmailVerification(credential.user);

    const appUser: Omit<AppUser, 'id'> = {
      name,
      phone,
      email,
      role,
      createdAt: new Date(),
    };

    await setDoc(doc(this.firestore, 'users', credential.user.uid), {
      ...appUser,
      createdAt: serverTimestamp(),
    });

    const uid = credential.user.uid;

    if (canManageTenants(role)) {
      await this.inviteCodeService.ensureOwnerCode(uid, name);
    }

    await signOut(this.auth);
    this.currentUser.set(null);
    this.firebaseUser.set(null);
    this.emailVerified.set(false);
  }

  async linkWithInviteCode(
    userId: string,
    profile: { name: string; phone: string; email: string },
    inviteCode: string,
    unitId?: string
  ) {
    const result = await this.inviteCodeService.redeem(inviteCode, userId, profile, unitId);
    await this.loadUserProfile(userId);
    return result;
  }

  async login(email: string, password: string): Promise<void> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
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
      await this.loadUserProfile(credential.user.uid);
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

  async updateProfile(updates: { name: string; phone: string }): Promise<void> {
    const firebaseUser = this.firebaseUser();
    const appUser = this.currentUser();
    if (!firebaseUser || !appUser) {
      throw new Error('Not signed in');
    }

    await updateFirebaseProfile(firebaseUser, { displayName: updates.name });
    await updateDoc(doc(this.firestore, 'users', firebaseUser.uid), {
      name: updates.name,
      phone: updates.phone,
    });

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

  private async loadUserProfile(uid: string): Promise<void> {
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
      photoUrl: data['photoUrl'],
      linkedOwnerId: data['linkedOwnerId'],
      linkedPropertyId: data['linkedPropertyId'],
      tenantRecordId: data['tenantRecordId'],
      createdAt: data['createdAt']?.toDate?.() ?? new Date(),
    });
  }
}
