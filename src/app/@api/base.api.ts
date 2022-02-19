import { AngularFirestore, AngularFirestoreCollection, AngularFirestoreCollectionGroup } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { WEN_FUNC } from "functions/interfaces/functions";
import { firstValueFrom, map, Observable, switchMap } from 'rxjs';
import { COL, EthAddress, SUB_COL } from "./../../../functions/interfaces/models/base";

export const DEFAULT_LIST_SIZE = 50;
export const WHERE_IN_BATCH = 10;
export const FULL_LIST = 10000;

export interface FbRef {
  (ref: any): any;
};

export class BaseApi<T> {
  // Collection is always defined on above.
  public collection = '';
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {}

  public listen(id: string): Observable<T|undefined> {
    return this.afs.collection<T>(this.collection).doc(id.toLowerCase()).valueChanges();
  }

  public last(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<T[]> {
    return this._query(this.collection, 'createdOn', 'asc', lastValue, search, def);
  }

  public top(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<T[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, search, def);
  }

  public alphabetical(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<T[]> {
    return this._query(this.collection, 'name', 'asc', lastValue, search, def);
  }

  public lastByRank(lastValue?: any, search?: string, def = DEFAULT_LIST_SIZE): Observable<T[]> {
    return this._query(this.collection, ['rank', 'createdOn'], 'desc', lastValue, search, def);
  }

  protected _query(
    collection: string,
    orderBy: string|string[] = 'createdOn',
    direction: any = 'desc',
    lastValue?: any,
    search?: string,
    def = DEFAULT_LIST_SIZE,
    refCust?: (subRef: any) => any,
  ): Observable<T[]> {
    const ref: AngularFirestoreCollection<T> = this.afs.collection<T>(
      collection,
      // We limit this to last record only. CreatedOn is always defined part of every record.
      (ref: any) => {
        const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];
        let query: any = refCust ? refCust(ref) : ref;
        if (search && search.length > 0) {
          query = query.where('keywords', 'array-contains', search.toLowerCase());
        }

        order.forEach((o) => {
          query = query.orderBy(o, direction);
        });

        if (lastValue) {
          query = query.startAfter(lastValue).limit(def);
        } else {
          query = query.limit(def);
        }

        return query;
      }
    );
    return ref.snapshotChanges().pipe(map((actions) => {
      // We need cursor.
      return actions.map(a => {
        const data = a.payload.doc.data();
        const doc = a.payload.doc;
        return {...data, _doc: doc };
      });
    }));
  }

  // TODO Redo arguments into an object
  public subCollectionMembers<T>(
    docId: string,
    subCol: SUB_COL,
    lastValue?: any,
    searchIds?: string[],
    manipulateOutput?: (original: any, finObj: any) => any,
    orderBy: string|string[] = 'createdOn',
    direction: any = 'desc',
    def = DEFAULT_LIST_SIZE,
    refCust?: (subRef: any) => any,
  ): Observable<T[]> {
    const ref: any = this.afs.collection(this.collection).doc(docId.toLowerCase()).collection(subCol, (subRef) => {
      let query: any = refCust ? refCust(subRef) : subRef;

      // Apply search on IDS.
      if (searchIds && searchIds.length > 0) {
        query = query.where('uid', 'in', searchIds);
      }

      const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];
      order.forEach((o) => {
        query = query.orderBy(o, direction);
      });
      if (lastValue) {
        query = query.startAfter(lastValue).limit(def);
      } else {
        query = query.limit(def);
      }

      return query;
    });

    return ref.valueChanges().pipe(switchMap(async (obj: any[]) => {
      const out: T[] = [];
      const subRecords: T[] = await this.getSubRecordsInBatches(COL.MEMBER, obj.map((o) => {
        return o.uid;
      }));

      for (const o of obj) {
        const finObj: any = subRecords.find((subO: any) => {
          return subO.uid === o.uid;
        });

        if (!finObj) {
          console.warn('Missing record in database');
        } else {
          if (manipulateOutput) {
            out.push(manipulateOutput(o, finObj));
          } else {
            out.push(finObj);
          }
        }
      }

      return out;
    }));
  }

  protected async getSubRecordsInBatches(col: COL, records: string[]): Promise<any[]> {
    const out: any = [];
    for (let i = 0, j = records.length; i < j; i += WHERE_IN_BATCH) {
        const batchToGet: string[] = records.slice(i, i + WHERE_IN_BATCH);
        const query: any = await firstValueFrom(this.afs.collection(col, (ref) => {
          return ref.where('uid', 'in', batchToGet);
        }).get());
        if (query.size > 0) {
          for (const doc of query.docs) {
            out.push(doc.data());
          }
        }
    }

    return out;
  }

  // TODO Implement proper typings.
  protected topParent(
    col: COL,
    subCol: SUB_COL,
    memberId: EthAddress,
    orderBy: string|string[] = 'createdOn',
    lastValue?: any,
    def = DEFAULT_LIST_SIZE,
    refCust?: (subRef: any) => any,
    frRef?: FbRef
  ): Observable<any[]> {
    const ref: AngularFirestoreCollectionGroup = this.afs.collectionGroup(
      subCol,
      (ref: any) => {
        const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];
        let query: any = ref.where('uid', '==', memberId).where('parentCol', '==',  col);
        query = refCust ? refCust(query) : query;
        order.forEach((o) => {
          query = query.orderBy(o, 'desc');
        });

        if (lastValue) {
          query = query.startAfter(lastValue).limit(def);
        } else {
          query = query.limit(def);
        }

        return query;
      }
    );
    return ref.valueChanges().pipe(switchMap(async (obj: any[]) => {
      const out: any[] = [];
      const subRecords: T[] = await this.getSubRecordsInBatches(col, obj.map((o) => {
        return o.parentId;
      }));

      for (const o of obj) {
        const finObj: any = subRecords.find((subO: any) => {
          return subO.uid === o.parentId;
        });
        if (!finObj) {
          console.warn('Missing record in database');
        } else {
          if ((frRef && frRef(finObj)) || !frRef) {
            out.push(finObj);
          }
        }
      }

      return out;
    }));
  }

  protected request<T>(func: WEN_FUNC, req: any): Observable<T|undefined> {
    const callable = this.fns.httpsCallable(func);
    const data$ = callable(req);
    return data$;
  }
}
