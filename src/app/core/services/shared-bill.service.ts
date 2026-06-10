import { EnvironmentInjector, Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  query,
  Query,
  serverTimestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, map, of } from 'rxjs';
import { SharedBill, SharedBillType, SplitMethod } from '../models/shared-bill.model';
import { observeCollection } from '../utils/firestore-observable';
import { observeByPropertyIds } from '../utils/property-query.utils';
import { stripUndefined, toDate } from '../utils/firestore.utils';

export interface CreateSharedBillDto {
  propertyId: string;
  type: SharedBillType;
  amount: number;
  households: number;
  splitMethod: SplitMethod;
  description?: string;
  date: Date;
  createdBy: string;
}

@Injectable({ providedIn: 'root' })
export class SharedBillService {
  private firestore = inject(Firestore);
  private injector = inject(EnvironmentInjector);
  private collection = collection(this.firestore, 'sharedBills');

  getByProperty(propertyId: string): Observable<SharedBill[]> {
    const q = query(this.collection, where('propertyId', '==', propertyId));
    return this.mapBills(q);
  }

  getByOwnerProperties(propertyIds: string[]): Observable<SharedBill[]> {
    if (propertyIds.length === 0) return of([]);

    return observeByPropertyIds<SharedBill>(this.injector, this.collection, propertyIds).pipe(
      map((items) =>
        items
          .map((item) => ({
            ...item,
            date: toDate(item.date),
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime())
      )
    );
  }

  async create(data: CreateSharedBillDto): Promise<string> {
    const ref = await addDoc(
      this.collection,
      stripUndefined({
        ...data,
        date: Timestamp.fromDate(data.date),
        createdAt: serverTimestamp(),
      })
    );
    return ref.id;
  }

  async update(
    id: string,
    data: Partial<Omit<CreateSharedBillDto, 'propertyId' | 'createdBy'>>
  ): Promise<void> {
    const { date, ...rest } = data;
    await updateDoc(
      doc(this.firestore, 'sharedBills', id),
      stripUndefined({
        ...rest,
        ...(date ? { date: Timestamp.fromDate(date) } : {}),
      })
    );
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'sharedBills', id));
  }

  private mapBills(q: Query): Observable<SharedBill[]> {
    return observeCollection<SharedBill>(this.injector, q).pipe(
      map((items) =>
        items
          .map((item) => ({
            ...item,
            date: toDate(item.date),
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime())
      )
    );
  }
}
