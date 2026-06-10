import { Injectable, EnvironmentInjector, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { Property, PropertyType } from '../models/property.model';
import { observeDocumentById, observeQuery } from '../utils/firestore-observable';
import { stripUndefined, toDate } from '../utils/firestore.utils';

export interface CreatePropertyDto {
  name: string;
  type: PropertyType;
  address: string;
  country: string;
  currency: string;
  imageUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class PropertyService {
  private firestore = inject(Firestore);
  private injector = inject(EnvironmentInjector);
  private collection = collection(this.firestore, 'properties');

  getByOwner(ownerId: string): Observable<Property[]> {
    return observeQuery<Property>(this.injector, () =>
      query(this.collection, where('ownerId', '==', ownerId))
    ).pipe(
      map((items) =>
        items.map((item) => ({
          ...(item as Property),
          createdAt: toDate((item as Property).createdAt),
        }))
      )
    );
  }

  getById(id: string): Observable<Property | undefined> {
    return observeDocumentById<Property>(this.injector, this.firestore, 'properties', id).pipe(
      map((item) =>
        item
          ? {
              ...(item as Property),
              createdAt: toDate((item as Property).createdAt),
            }
          : undefined
      )
    );
  }

  async create(ownerId: string, data: CreatePropertyDto): Promise<string> {
    const ref = await addDoc(
      this.collection,
      stripUndefined({
        ...data,
        ownerId,
        totalUnits: 0,
        createdAt: serverTimestamp(),
      })
    );
    return ref.id;
  }

  async update(id: string, data: Partial<CreatePropertyDto>, options?: { removeImage?: boolean }): Promise<void> {
    const payload = stripUndefined({
      ...data,
      ...(options?.removeImage ? { imageUrl: deleteField() } : {}),
    });
    await updateDoc(doc(this.firestore, 'properties', id), payload);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'properties', id));
  }

  async updateUnitCount(id: string, count: number): Promise<void> {
    await updateDoc(doc(this.firestore, 'properties', id), { totalUnits: count });
  }
}
