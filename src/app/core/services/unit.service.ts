import { EnvironmentInjector, Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { Unit, UnitStatus, UnitType } from '../models/unit.model';
import { observeCollection, observeDocumentById, observeQuery } from '../utils/firestore-observable';

export interface CreateUnitDto {
  name: string;
  type: UnitType | string;
  rooms: number;
  bathrooms: number;
  monthlyRent: number;
  status?: UnitStatus;
}

@Injectable({ providedIn: 'root' })
export class UnitService {
  private firestore = inject(Firestore);
  private injector = inject(EnvironmentInjector);
  private collection = collection(this.firestore, 'units');

  getByProperty(propertyId: string): Observable<Unit[]> {
    return observeQuery<Unit>(this.injector, () =>
      query(this.collection, where('propertyId', '==', propertyId))
    ).pipe(map((items) => items as Unit[]));
  }

  /** Vacant units only — safe for tenants joining via property invite code. */
  getVacantByProperty(propertyId: string): Observable<Unit[]> {
    return observeQuery<Unit>(this.injector, () =>
      query(
        this.collection,
        where('propertyId', '==', propertyId),
        where('status', '==', 'vacant')
      )
    ).pipe(map((items) => items as Unit[]));
  }

  getById(id: string): Observable<Unit | undefined> {
    return observeDocumentById<Unit>(this.injector, this.firestore, 'units', id).pipe(
      map((item) => (item ? (item as Unit) : undefined))
    );
  }

  async create(propertyId: string, data: CreateUnitDto): Promise<string> {
    const ref = await addDoc(this.collection, {
      ...data,
      propertyId,
      status: data.status ?? 'vacant',
    });
    return ref.id;
  }

  async update(id: string, data: Partial<CreateUnitDto & { status: UnitStatus }>): Promise<void> {
    await updateDoc(doc(this.firestore, 'units', id), data);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'units', id));
  }
}
