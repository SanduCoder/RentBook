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
import { Expense, ExpenseCategory } from '../models/expense.model';
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
    const ref = await addDoc(this.collection, {
      ...data,
      date: Timestamp.fromDate(data.date),
      createdAt: serverTimestamp(),
    });
    return ref.id;
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
