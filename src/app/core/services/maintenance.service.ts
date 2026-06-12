import { EnvironmentInjector, Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  doc,
  query,
  Query,
  serverTimestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, map, of } from 'rxjs';
import {
  MaintenanceCategory,
  MaintenanceRequest,
  MaintenanceStatus,
} from '../models/maintenance.model';
import { observeCollection } from '../utils/firestore-observable';
import { observeByPropertyIds } from '../utils/property-query.utils';
import { stripUndefined, toDate } from '../utils/firestore.utils';

export interface CreateMaintenanceDto {
  propertyId: string;
  tenantId: string;
  tenantName?: string;
  title: string;
  description: string;
  category: MaintenanceCategory;
  reportedBy: string;
  reportedByTenant?: boolean;
}

@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private firestore = inject(Firestore);
  private injector = inject(EnvironmentInjector);
  private collection = collection(this.firestore, 'maintenanceRequests');

  getByProperty(propertyId: string): Observable<MaintenanceRequest[]> {
    const q = query(this.collection, where('propertyId', '==', propertyId));
    return this.mapRequests(q);
  }

  getByOwnerProperties(propertyIds: string[]): Observable<MaintenanceRequest[]> {
    return observeByPropertyIds<MaintenanceRequest>(this.injector, this.collection, propertyIds).pipe(
      map((items) =>
        items
          .map((item) => ({
            ...item,
            createdAt: toDate(item.createdAt),
          }))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      )
    );
  }

  getByTenantRecord(tenantRecordId: string): Observable<MaintenanceRequest[]> {
    const q = query(this.collection, where('tenantId', '==', tenantRecordId));
    return this.mapRequests(q);
  }

  getOpenCount(propertyIds: string[]): Observable<number> {
    return this.getByOwnerProperties(propertyIds).pipe(
      map((requests) => requests.filter((r) => r.status !== 'completed').length)
    );
  }

  async create(data: CreateMaintenanceDto): Promise<string> {
    const ref = await addDoc(
      this.collection,
      stripUndefined({
        ...data,
        tenantId: data.tenantId || '',
        photos: [],
        status: 'open' as MaintenanceStatus,
        createdAt: serverTimestamp(),
      })
    );
    return ref.id;
  }

  async updateStatus(id: string, status: MaintenanceStatus): Promise<void> {
    await updateDoc(doc(this.firestore, 'maintenanceRequests', id), { status });
  }

  private mapRequests(q: Query): Observable<MaintenanceRequest[]> {
    return observeCollection<MaintenanceRequest>(this.injector, q).pipe(
      map((items) =>
        items
          .map((item) => ({
            ...item,
            createdAt: toDate(item.createdAt),
          }))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      )
    );
  }
}
