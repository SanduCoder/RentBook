import { EnvironmentInjector, Injectable, inject, runInInjectionContext } from '@angular/core';
import { AppCheck } from '@angular/fire/app-check';
import {
  Firestore,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import {
  InviteCode,
  RedeemInviteResult,
  generateInviteCode,
  normalizeInviteCode,
} from '../models/invite-code.model';
import { ensureAppCheckReady } from '../utils/app-check.utils';
import { toDate } from '../utils/firestore.utils';

@Injectable({ providedIn: 'root' })
export class InviteCodeService {
  private firestore = inject(Firestore);
  private appCheck = inject(AppCheck, { optional: true });
  private injector = inject(EnvironmentInjector);

  lookup(code: string): Observable<InviteCode | undefined> {
    return from(this.getByCode(code));
  }

  async getByCode(code: string): Promise<InviteCode | undefined> {
    const normalized = normalizeInviteCode(code);
    if (normalized.length < 7) return undefined;

    const snap = await this.run((fs) => getDoc(doc(fs, 'inviteCodes', normalized)));
    if (!snap.exists()) return undefined;

    const data = snap.data();
    if (!data['active']) return undefined;

    return {
      id: snap.id,
      type: data['type'],
      ownerId: data['ownerId'],
      ownerName: data['ownerName'],
      propertyId: data['propertyId'],
      propertyName: data['propertyName'],
      active: data['active'],
      createdAt: toDate(data['createdAt']),
    };
  }

  async ensureOwnerCode(ownerId: string, ownerName: string): Promise<string> {
    await ensureAppCheckReady(this.appCheck ?? null);
    const userSnap = await this.run((fs) => getDoc(doc(fs, 'users', ownerId)));
    const existingCode = userSnap.data()?.['ownerInviteCode'] as string | undefined;
    if (existingCode) return existingCode;

    return this.replaceOwnerCode(ownerId, ownerName);
  }

  async ensurePropertyCode(
    ownerId: string,
    ownerName: string,
    propertyId: string,
    propertyName: string
  ): Promise<string> {
    await ensureAppCheckReady(this.appCheck ?? null);
    const propertySnap = await this.run((fs) => getDoc(doc(fs, 'properties', propertyId)));
    const existingCode = propertySnap.data()?.['inviteCode'] as string | undefined;
    if (existingCode) return existingCode;

    return this.replacePropertyCode(ownerId, ownerName, propertyId, propertyName);
  }

  async regenerateOwnerCode(ownerId: string, ownerName: string): Promise<string> {
    await ensureAppCheckReady(this.appCheck ?? null);
    const userSnap = await this.run((fs) => getDoc(doc(fs, 'users', ownerId)));
    const existingCode = userSnap.data()?.['ownerInviteCode'] as string | undefined;
    return this.replaceOwnerCode(ownerId, ownerName, existingCode);
  }

  async regeneratePropertyCode(
    ownerId: string,
    ownerName: string,
    propertyId: string,
    propertyName: string
  ): Promise<string> {
    await ensureAppCheckReady(this.appCheck ?? null);
    const propertySnap = await this.run((fs) => getDoc(doc(fs, 'properties', propertyId)));
    const existingCode = propertySnap.data()?.['inviteCode'] as string | undefined;
    return this.replacePropertyCode(ownerId, ownerName, propertyId, propertyName, existingCode);
  }

  /**
   * Connect a tenant account to its landlord using any invite code (owner or property).
   * The owner assigns the actual unit afterwards — tenants never self-select a unit.
   */
  async redeem(code: string, userId: string): Promise<RedeemInviteResult> {
    await ensureAppCheckReady(this.appCheck ?? null);
    const invite = await this.getByCode(code);
    if (!invite) {
      throw new Error('Invalid or inactive invite code.');
    }

    const userSnap = await this.run((fs) => getDoc(doc(fs, 'users', userId)));
    const userData = userSnap.exists() ? userSnap.data() : undefined;

    if (userData?.['tenantRecordId']) {
      throw new Error('Your account is already linked to a tenancy.');
    }

    const linkedOwnerId = userData?.['linkedOwnerId'] as string | undefined;
    if (linkedOwnerId && linkedOwnerId !== invite.ownerId) {
      throw new Error('Your account is already connected to a different landlord.');
    }

    await this.run((fs) =>
      updateDoc(doc(fs, 'users', userId), {
        linkedOwnerId: invite.ownerId,
        role: 'tenant',
      })
    );

    return {
      type: invite.type,
      ownerId: invite.ownerId,
      propertyId: invite.propertyId,
      pendingAssignment: true,
    };
  }

  private async replaceOwnerCode(
    ownerId: string,
    ownerName: string,
    previousCode?: string
  ): Promise<string> {
    if (previousCode) {
      await this.deactivateCode(previousCode);
    }

    const code = await this.createCode({
      type: 'owner',
      ownerId,
      ownerName,
    });

    await this.run((fs) =>
      updateDoc(doc(fs, 'users', ownerId), { ownerInviteCode: code })
    );

    return code;
  }

  private async replacePropertyCode(
    ownerId: string,
    ownerName: string,
    propertyId: string,
    propertyName: string,
    previousCode?: string
  ): Promise<string> {
    if (previousCode) {
      await this.deactivateCode(previousCode);
    }

    const code = await this.createCode({
      type: 'property',
      ownerId,
      ownerName,
      propertyId,
      propertyName,
    });

    await this.run((fs) =>
      updateDoc(doc(fs, 'properties', propertyId), { inviteCode: code })
    );

    return code;
  }

  private async deactivateCode(code: string): Promise<void> {
    try {
      await this.run((fs) => deleteDoc(doc(fs, 'inviteCodes', code)));
    } catch {
      // Old code may already be gone or inaccessible — safe to ignore.
    }
  }

  private async createCode(data: {
    type: InviteCode['type'];
    ownerId: string;
    ownerName: string;
    propertyId?: string;
    propertyName?: string;
  }): Promise<string> {
    for (let attempt = 0; attempt < 16; attempt++) {
      const code = generateInviteCode();

      try {
        await this.run((fs) =>
          setDoc(doc(fs, 'inviteCodes', code), {
            type: data.type,
            ownerId: data.ownerId,
            ownerName: data.ownerName,
            ...(data.propertyId ? { propertyId: data.propertyId } : {}),
            ...(data.propertyName ? { propertyName: data.propertyName } : {}),
            active: true,
            createdAt: serverTimestamp(),
          })
        );
        return code;
      } catch {
        // Code already taken or write blocked — try another.
      }
    }

    throw new Error('Could not generate a unique invite code. Please try again.');
  }

  private run<T>(fn: (firestore: Firestore) => T | Promise<T>): Promise<T> {
    return runInInjectionContext(this.injector, () => Promise.resolve(fn(this.firestore)));
  }
}
