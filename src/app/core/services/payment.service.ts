import { EnvironmentInjector, Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  query,
  Query,
  serverTimestamp,
  where,
} from '@angular/fire/firestore';
import { Observable, map, of } from 'rxjs';
import { Payment, PaymentMethod, PaymentStatus } from '../models/payment.model';
import { observeCollection, observeQuery } from '../utils/firestore-observable';
import { observeByPropertyIds } from '../utils/property-query.utils';
import { stripUndefined, toDate } from '../utils/firestore.utils';

export interface CreatePaymentDto {
  tenantId: string;
  propertyId: string;
  unitId: string;
  amount: number;
  date: Date;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  status: PaymentStatus;
  recordedBy: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private firestore = inject(Firestore);
  private injector = inject(EnvironmentInjector);
  private collection = collection(this.firestore, 'payments');

  getByProperty(propertyId: string): Observable<Payment[]> {
    return observeQuery<Payment>(this.injector, () =>
      query(this.collection, where('propertyId', '==', propertyId))
    ).pipe(
      map((items) =>
        items
          .map((item) => ({
            ...item,
            date: toDate(item.date),
            createdAt: toDate(item.createdAt),
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime())
      )
    );
  }

  getByTenant(tenantId: string): Observable<Payment[]> {
    return observeQuery<Payment>(this.injector, () =>
      query(this.collection, where('tenantId', '==', tenantId))
    ).pipe(
      map((items) =>
        items
          .map((item) => ({
            ...item,
            date: toDate(item.date),
            createdAt: toDate(item.createdAt),
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime())
      )
    );
  }

  getByOwnerProperties(propertyIds: string[]): Observable<Payment[]> {
    return observeByPropertyIds<Payment>(this.injector, this.collection, propertyIds).pipe(
      map((items) =>
        items
          .map((item) => ({
            ...item,
            date: toDate(item.date),
            createdAt: toDate(item.createdAt),
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime())
      )
    );
  }

  async create(data: CreatePaymentDto): Promise<string> {
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

  generateReceiptNumber(paymentId: string): string {
    return `RB-${paymentId.slice(0, 8).toUpperCase()}`;
  }

  private mapPayments(q: Query): Observable<Payment[]> {
    return observeCollection<Payment>(this.injector, q).pipe(
      map((items) =>
        items
          .map((item) => ({
            ...item,
            date: toDate(item.date),
            createdAt: toDate(item.createdAt),
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime())
      )
    );
  }
}
