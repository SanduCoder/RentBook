import { EnvironmentInjector, Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, map, of } from 'rxjs';
import { Tenant } from '../models/tenant.model';
import { observeCollection, observeDocumentById } from '../utils/firestore-observable';
import { observeByPropertyIds } from '../utils/property-query.utils';
import { stripUndefined, toDate } from '../utils/firestore.utils';
import { UnitService } from './unit.service';

export interface AssignPendingTenantDto {
  propertyId: string;
  unitId: string;
  monthlyRent: number;
  dueDay: number;
  moveInDate: Date;
}

export interface CreateTenantDto {
  name: string;
  phone: string;
  email?: string;
  occupation?: string;
  moveInDate: Date;
  monthlyRent: number;
  dueDay: number;
  unitId: string;
  propertyId: string;
  userId?: string;
  pendingAssignment?: boolean;
}

@Injectable({ providedIn: 'root' })
export class TenantService {
  private firestore = inject(Firestore);
  private injector = inject(EnvironmentInjector);
  private unitService = inject(UnitService);
  private collection = collection(this.firestore, 'tenants');

  getByProperty(propertyId: string): Observable<Tenant[]> {
    const q = query(this.collection, where('propertyId', '==', propertyId));
    return this.mapTenants(q);
  }

  getByOwnerProperties(propertyIds: string[]): Observable<Tenant[]> {
    return observeByPropertyIds<Tenant>(this.injector, this.collection, propertyIds).pipe(
      map((items) =>
        items
          .map((item) => ({
            ...item,
            moveInDate: toDate(item.moveInDate),
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
    );
  }

  getByUnit(unitId: string): Observable<Tenant | undefined> {
    const q = query(this.collection, where('unitId', '==', unitId));
    return observeCollection<Tenant>(this.injector, q).pipe(
      map((items) => {
        const tenant = items.find((item) => item.active !== false);
        return tenant
          ? { ...tenant, moveInDate: toDate(tenant.moveInDate) }
          : undefined;
      })
    );
  }

  getById(id: string): Observable<Tenant | undefined> {
    return observeDocumentById<Tenant>(this.injector, this.firestore, 'tenants', id).pipe(
      map((item) =>
        item
          ? {
              ...item,
              moveInDate: toDate(item.moveInDate),
            }
          : undefined
      )
    );
  }

  async create(data: CreateTenantDto): Promise<string> {
    const ref = await addDoc(this.collection, stripUndefined({
      ...data,
      moveInDate: Timestamp.fromDate(data.moveInDate),
      active: true,
    }));
    return ref.id;
  }

  async update(id: string, data: Partial<CreateTenantDto>): Promise<void> {
    const { moveInDate, ...rest } = data;
    await updateDoc(
      doc(this.firestore, 'tenants', id),
      stripUndefined({
        ...rest,
        ...(moveInDate ? { moveInDate: Timestamp.fromDate(moveInDate) } : {}),
      })
    );
  }

  async deactivate(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'tenants', id), { active: false });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'tenants', id));
  }

  async assignPendingUser(
    ownerId: string,
    userId: string,
    data: AssignPendingTenantDto
  ): Promise<string> {
    const userSnap = await getDoc(doc(this.firestore, 'users', userId));
    if (!userSnap.exists()) {
      throw new Error('User not found.');
    }

    const user = userSnap.data();
    if (user['linkedOwnerId'] !== ownerId) {
      throw new Error('This user is not linked to your account.');
    }
    if (user['tenantRecordId']) {
      throw new Error('This user has already been assigned to a unit.');
    }

    const propertySnap = await getDoc(doc(this.firestore, 'properties', data.propertyId));
    if (!propertySnap.exists() || propertySnap.data()['ownerId'] !== ownerId) {
      throw new Error('Property not found.');
    }

    const unitSnap = await getDoc(doc(this.firestore, 'units', data.unitId));
    if (!unitSnap.exists()) {
      throw new Error('Unit not found.');
    }

    const unit = unitSnap.data();
    if (unit['propertyId'] !== data.propertyId) {
      throw new Error('Selected unit does not belong to this property.');
    }
    if (unit['status'] !== 'vacant') {
      throw new Error('Selected unit is no longer vacant.');
    }

    const tenantRecordId = await this.create({
      name: user['name'] ?? '',
      phone: user['phone'] ?? '',
      email: user['email'],
      moveInDate: data.moveInDate,
      monthlyRent: data.monthlyRent,
      dueDay: data.dueDay,
      unitId: data.unitId,
      propertyId: data.propertyId,
      userId,
    });

    await this.unitService.update(data.unitId, { status: 'occupied' });
    await updateDoc(doc(this.firestore, 'users', userId), {
      linkedPropertyId: data.propertyId,
      tenantRecordId,
    });

    return tenantRecordId;
  }

  private mapTenants(q: ReturnType<typeof query>): Observable<Tenant[]> {
    return observeCollection<Tenant>(this.injector, q).pipe(
      map((items) =>
        items
          .filter((item) => item.active !== false)
          .map((item) => ({
            ...item,
            moveInDate: toDate(item.moveInDate),
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
    );
  }
}
