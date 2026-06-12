import { EnvironmentInjector, Injectable, inject } from '@angular/core';
import { AppCheck } from '@angular/fire/app-check';
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
import { Payment, PaymentMethod, PaymentStatus } from '../models/payment.model';
import { observeCollection, observeQuery } from '../utils/firestore-observable';
import { observeByPropertyIds } from '../utils/property-query.utils';
import { ensureAppCheckReady } from '../utils/app-check.utils';
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
  reportedByTenant?: boolean;
}

export interface ReportPaymentDto {
  tenantId: string;
  propertyId: string;
  unitId: string;
  amount: number;
  date: Date;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  recordedBy: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private firestore = inject(Firestore);
  private appCheck = inject(AppCheck, { optional: true });
  private injector = inject(EnvironmentInjector);
  private collection = collection(this.firestore, 'payments');

  getByProperty(propertyId: string): Observable<Payment[]> {
    return observeQuery<Payment>(this.injector, () =>
      query(this.collection, where('propertyId', '==', propertyId))
    ).pipe(map((items) => this.normalizePayments(items)));
  }

  getByTenant(tenantId: string): Observable<Payment[]> {
    return observeQuery<Payment>(this.injector, () =>
      query(this.collection, where('tenantId', '==', tenantId))
    ).pipe(map((items) => this.normalizePayments(items)));
  }

  /** Landlord view — query by propertyId (allowed by rules), then filter to tenant. */
  getByTenantAtProperty(tenantId: string, propertyId: string): Observable<Payment[]> {
    return this.getByProperty(propertyId).pipe(
      map((items) => items.filter((p) => p.tenantId === tenantId))
    );
  }

  getByOwnerProperties(propertyIds: string[]): Observable<Payment[]> {
    return observeByPropertyIds<Payment>(this.injector, this.collection, propertyIds).pipe(
      map((items) => this.normalizePayments(items))
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

  async reportPayment(data: ReportPaymentDto): Promise<string> {
    await ensureAppCheckReady(this.appCheck ?? null);
    return this.create({
      ...data,
      status: 'pending_verification',
      reportedByTenant: true,
    });
  }

  async confirmPayment(id: string, status: 'paid' | 'partial' = 'paid'): Promise<void> {
    await updateDoc(doc(this.firestore, 'payments', id), { status });
  }

  async rejectReportedPayment(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'payments', id));
  }

  generateReceiptNumber(paymentId: string): string {
    return `RB-${paymentId.slice(0, 8).toUpperCase()}`;
  }

  private normalizePayments(items: Payment[]): Payment[] {
    return items
      .map((item) => this.normalizePayment(item))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  private normalizePayment(item: Payment): Payment {
    const date = toDate(item.date);
    const createdAt = toDate(item.createdAt, item.date);
    let status = item.status;

    if (
      item.reportedByTenant &&
      status !== 'paid' &&
      status !== 'partial' &&
      status !== 'pending_verification'
    ) {
      status = 'pending_verification';
    }

    return {
      ...item,
      date,
      createdAt,
      status,
    };
  }

  private mapPayments(q: Query): Observable<Payment[]> {
    return observeCollection<Payment>(this.injector, q).pipe(
      map((items) => this.normalizePayments(items))
    );
  }
}
