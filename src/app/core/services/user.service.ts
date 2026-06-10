import { EnvironmentInjector, Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { AppUser } from '../models/user.model';
import { observeQuery } from '../utils/firestore-observable';
import { toDate } from '../utils/firestore.utils';

export type PendingTenantUser = Pick<
  AppUser,
  'id' | 'name' | 'phone' | 'email' | 'linkedOwnerId' | 'createdAt'
>;

@Injectable({ providedIn: 'root' })
export class UserService {
  private firestore = inject(Firestore);
  private injector = inject(EnvironmentInjector);
  private collection = collection(this.firestore, 'users');

  getPendingByOwner(ownerId: string): Observable<PendingTenantUser[]> {
    return observeQuery<AppUser>(this.injector, () =>
      query(this.collection, where('linkedOwnerId', '==', ownerId))
    ).pipe(
      map((users) =>
        users
          .filter((user) => user.role === 'tenant' && !user.tenantRecordId)
          .map((user) => ({
            id: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            linkedOwnerId: user.linkedOwnerId!,
            createdAt: toDate(user.createdAt),
          }))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      )
    );
  }
}
