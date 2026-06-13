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
import { Expense, ExpenseCategory, SHARE_WITH_ALL_TENANTS } from '../models/expense.model';
import { observeCollection } from '../utils/firestore-observable';
import { observeByPropertyIds } from '../utils/property-query.utils';
import { getMonthStart, toDate } from '../utils/firestore.utils';

export interface CreateExpenseDto {
  propertyId: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  createdBy: string;
  date: Date;
  visibleToTenants: boolean;
  /** 'all' or a specific tenant record id. Only persisted when visibleToTenants is true. */
  sharedWithTenantId?: string;
  /** Tenants to split the cost across when sharing with all tenants. */
  splitTenantIds?: string[];
}

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private firestore = inject(Firestore);
  private injector = inject(EnvironmentInjector);
  private collection = collection(this.firestore, 'expenses');

  getByProperty(propertyId: string): Observable<Expense[]> {
    const q = query(this.collection, where('propertyId', '==', propertyId));
    return this.mapExpenses(q);
  }

  /** Expenses an owner shared with a specific tenant (or all tenants) of a property. */
  getVisibleByProperty(propertyId: string, tenantRecordId: string): Observable<Expense[]> {
    const q = query(
      this.collection,
      where('propertyId', '==', propertyId),
      where('visibleToTenants', '==', true),
      where('sharedWithTenantId', 'in', [SHARE_WITH_ALL_TENANTS, tenantRecordId])
    );
    return this.mapExpenses(q);
  }

  getByOwnerProperties(propertyIds: string[]): Observable<Expense[]> {
    if (propertyIds.length === 0) return of([]);

    return observeByPropertyIds<Expense>(this.injector, this.collection, propertyIds).pipe(
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

  getMonthlyTotal(propertyIds: string[], date = new Date()): Observable<number> {
    const monthStart = getMonthStart(date);
    return this.getByOwnerProperties(propertyIds).pipe(
      map((expenses) =>
        expenses
          .filter((e) => e.date >= monthStart)
          .reduce((sum, e) => sum + e.amount, 0)
      )
    );
  }

  async create(data: CreateExpenseDto): Promise<string> {
    const { sharedWithTenantId, splitTenantIds, ...rest } = data;
    const resolvedShare = sharedWithTenantId || SHARE_WITH_ALL_TENANTS;
    const targetsSpecificTenant =
      data.visibleToTenants && resolvedShare !== SHARE_WITH_ALL_TENANTS;
    const splitsAcrossTenants =
      data.visibleToTenants &&
      resolvedShare === SHARE_WITH_ALL_TENANTS &&
      !!splitTenantIds &&
      splitTenantIds.length > 0;
    const ref = await addDoc(this.collection, {
      ...rest,
      ...(data.visibleToTenants ? { sharedWithTenantId: resolvedShare } : {}),
      ...(targetsSpecificTenant ? { settlementStatus: 'unpaid' } : {}),
      ...(splitsAcrossTenants ? { splitTenantIds, tenantSettlements: {} } : {}),
      date: Timestamp.fromDate(data.date),
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }

  /** Update one tenant's settlement entry within a split expense. */
  async setShareStatus(
    expenseId: string,
    tenantId: string,
    status: 'unpaid' | 'pending_confirmation' | 'paid'
  ): Promise<void> {
    await updateDoc(doc(this.firestore, 'expenses', expenseId), {
      [`tenantSettlements.${tenantId}`]: status,
    });
  }

  /** Tenant claims they have paid an assigned expense (awaits owner confirmation). */
  async tenantMarkPaid(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'expenses', id), {
      settlementStatus: 'pending_confirmation',
    });
  }

  /** Tenant reverts their "paid" claim before the owner confirms it. */
  async tenantUndoPaid(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'expenses', id), {
      settlementStatus: 'unpaid',
    });
  }

  /** Owner confirms (or directly records) that an assigned expense has been paid. */
  async confirmPaid(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'expenses', id), {
      settlementStatus: 'paid',
    });
  }

  /** Owner reopens an expense as unpaid. */
  async markUnpaid(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'expenses', id), {
      settlementStatus: 'unpaid',
    });
  }

  async update(
    id: string,
    data: Partial<Omit<CreateExpenseDto, 'propertyId' | 'createdBy'>>
  ): Promise<void> {
    const { date, ...rest } = data;
    await updateDoc(doc(this.firestore, 'expenses', id), {
      ...rest,
      ...(date ? { date: Timestamp.fromDate(date) } : {}),
    });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'expenses', id));
  }

  private mapExpenses(q: Query): Observable<Expense[]> {
    return observeCollection<Expense>(this.injector, q).pipe(
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
