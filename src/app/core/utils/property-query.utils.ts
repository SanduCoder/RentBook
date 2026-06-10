import { EnvironmentInjector } from '@angular/core';
import {
  CollectionReference,
  DocumentData,
  Query,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable, combineLatest, map, of } from 'rxjs';
import { observeCollection } from './firestore-observable';

const FIRESTORE_IN_LIMIT = 10;

export function chunkIds<T>(ids: T[], size = FIRESTORE_IN_LIMIT): T[][] {
  if (ids.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

export function observeByPropertyIds<T extends { propertyId?: string }>(
  injector: EnvironmentInjector,
  collectionRef: CollectionReference<DocumentData>,
  propertyIds: string[]
): Observable<T[]> {
  const chunks = chunkIds(propertyIds);
  if (chunks.length === 0) return of([]);

  const queries = chunks.map((ids) =>
    query(collectionRef, where('propertyId', 'in', ids))
  );

  if (queries.length === 1) {
    return observeCollection<T>(injector, queries[0]);
  }

  return combineLatest(queries.map((q) => observeCollection<T>(injector, q))).pipe(
    map((groups) => groups.flat())
  );
}
