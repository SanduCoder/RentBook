import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  collectionData,
  doc,
  docData,
  DocumentReference,
  Firestore,
  Query,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function observeCollection<T>(
  injector: EnvironmentInjector,
  q: Query<any>
): Observable<(T & { id: string })[]> {
  return runInInjectionContext(injector, () =>
    collectionData(q, { idField: 'id' })
  ) as Observable<(T & { id: string })[]>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function observeDocument<T>(
  injector: EnvironmentInjector,
  ref: DocumentReference<any>
): Observable<(T & { id: string }) | undefined> {
  return runInInjectionContext(injector, () =>
    docData(ref, { idField: 'id' })
  ) as Observable<(T & { id: string }) | undefined>;
}

export function observeDocumentById<T>(
  injector: EnvironmentInjector,
  firestore: Firestore,
  collectionName: string,
  id: string
): Observable<(T & { id: string }) | undefined> {
  return runInInjectionContext(injector, () => {
    const ref = doc(firestore, collectionName, id);
    return docData(ref, { idField: 'id' });
  }) as Observable<(T & { id: string }) | undefined>;
}

export function observeQuery<T>(
  injector: EnvironmentInjector,
  buildQuery: () => Query
): Observable<(T & { id: string })[]> {
  return runInInjectionContext(injector, () =>
    collectionData(buildQuery(), { idField: 'id' })
  ) as Observable<(T & { id: string })[]>;
}
