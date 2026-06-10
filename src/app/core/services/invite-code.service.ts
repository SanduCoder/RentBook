import { EnvironmentInjector, Injectable, inject, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
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
import { toDate } from '../utils/firestore.utils';
import { TenantService } from './tenant.service';
import { UnitService } from './unit.service';

@Injectable({ providedIn: 'root' })
export class InviteCodeService {
  private firestore = inject(Firestore);
  private injector = inject(EnvironmentInjector);
  private tenantService = inject(TenantService);
  private unitService = inject(UnitService);

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
    const propertySnap = await this.run((fs) => getDoc(doc(fs, 'properties', propertyId)));
    const existingCode = propertySnap.data()?.['inviteCode'] as string | undefined;
    if (existingCode) return existingCode;

    return this.replacePropertyCode(ownerId, ownerName, propertyId, propertyName);
  }

  async regenerateOwnerCode(ownerId: string, ownerName: string): Promise<string> {
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
    const propertySnap = await this.run((fs) => getDoc(doc(fs, 'properties', propertyId)));
    const existingCode = propertySnap.data()?.['inviteCode'] as string | undefined;
    return this.replacePropertyCode(ownerId, ownerName, propertyId, propertyName, existingCode);
  }

  async redeem(
    code: string,
    userId: string,
    profile: { name: string; phone: string; email: string },
    unitId?: string
  ): Promise<RedeemInviteResult> {
    const invite = await this.getByCode(code);
    if (!invite) {
      throw new Error('Invalid or inactive invite code.');
    }

    const userSnap = await this.run((fs) => getDoc(doc(fs, 'users', userId)));
    const userData = userSnap.exists() ? userSnap.data() : undefined;

    if (userData?.['tenantRecordId']) {
      throw new Error('Your account is already linked to a tenancy.');
    }

    if (invite.type === 'owner') {
      if (userData?.['linkedOwnerId']) {
        throw new Error(
          'You are already connected to your landlord. Ask them for a property code to pick your unit.'
        );
      }

      await this.run((fs) =>
        updateDoc(doc(fs, 'users', userId), {
          linkedOwnerId: invite.ownerId,
          role: 'tenant',
        })
      );
      return {
        type: 'owner',
        ownerId: invite.ownerId,
        pendingAssignment: true,
      };
    }

    if (!invite.propertyId) {
      throw new Error('This property invite code is not configured correctly.');
    }

    const linkedOwnerId = userData?.['linkedOwnerId'] as string | undefined;
    if (linkedOwnerId && linkedOwnerId !== invite.ownerId) {
      throw new Error('This property belongs to a different landlord than your account is linked to.');
    }

    if (!unitId) {
      throw new Error('Please select a unit to join.');
    }

    const unitSnap = await this.run((fs) => getDoc(doc(fs, 'units', unitId)));
    if (!unitSnap.exists()) {
      throw new Error('Selected unit was not found.');
    }

    const unit = unitSnap.data();
    if (unit['propertyId'] !== invite.propertyId) {
      throw new Error('Selected unit does not belong to this property.');
    }
    if (unit['status'] !== 'vacant') {
      throw new Error('Selected unit is no longer available.');
    }

    const tenantRecordId = await this.run((fs) =>
      runTransaction(fs, async (transaction) => {
        const userRef = doc(fs, 'users', userId);
        const unitRef = doc(fs, 'units', unitId);
        const tenantRef = doc(collection(fs, 'tenants'));

        const userSnap = await transaction.get(userRef);
        const unitSnap = await transaction.get(unitRef);
        if (!unitSnap.exists()) {
          throw new Error('Selected unit was not found.');
        }

        const unitData = unitSnap.data();
        if (unitData['propertyId'] !== invite.propertyId) {
          throw new Error('Selected unit does not belong to this property.');
        }
        if (unitData['status'] !== 'vacant') {
          throw new Error('Selected unit is no longer available.');
        }

        const existingUser = userSnap.exists() ? userSnap.data() : undefined;
        const linkUpdate: Record<string, unknown> = {
          linkedPropertyId: invite.propertyId,
          role: 'tenant',
        };
        if (!existingUser?.['linkedOwnerId']) {
          linkUpdate['linkedOwnerId'] = invite.ownerId;
        }

        transaction.set(tenantRef, {
          name: profile.name,
          phone: profile.phone,
          email: profile.email,
          moveInDate: Timestamp.fromDate(new Date()),
          monthlyRent: unitData['monthlyRent'] ?? 0,
          dueDay: 1,
          unitId,
          propertyId: invite.propertyId,
          userId,
          active: true,
          createdAt: serverTimestamp(),
        });
        transaction.update(unitRef, { status: 'occupied' });
        transaction.update(userRef, {
          ...linkUpdate,
          tenantRecordId: tenantRef.id,
        });

        return tenantRef.id;
      })
    );

    return {
      type: 'property',
      ownerId: invite.ownerId,
      propertyId: invite.propertyId,
      tenantRecordId,
      pendingAssignment: false,
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
