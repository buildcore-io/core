import { AngularFirestore, AngularFirestoreCollection, AngularFirestoreCollectionGroup } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { WEN_FUNC } from "functions/interfaces/functions";
import { firstValueFrom, map, Observable, switchMap } from 'rxjs';
import { COL, EthAddress, SUB_COL } from "./../../../functions/interfaces/models/base";

export const DEFAULT_LIST_SIZE = 50;
export const WHERE_IN_BATCH = 10;
export const FULL_LIST = 10000;

export interface FbRef {
  (ref: any, ref2: any): any;
};

export interface QueryArgs {
  collection: string;
  orderBy?: string | string[];
  direction?: any;
  lastValue?: number;
  search?: string;
  def?: number;
  refCust?: (subRef: any) => any;
}

export interface SubCollectionMembersArgs {
  docId: string;
  subCol: SUB_COL;
  lastValue?: number;
  searchIds?: string[];
  manipulateOutput?: (original: any, finObj: any) => any;
  orderBy?: string | string[];
  direction?: any;
  def?: number;
  refCust?: (subRef: any) => any;
}

export interface TopParentArgs {
  col: COL;
  subCol: SUB_COL;
  memberId: EthAddress;
  orderBy?: string | string[];
  lastValue?: number;
  def?: number;
  refCust?: (subRef: any) => any;
  frRef?: FbRef;
}

export class BaseApi<T> {
  // Collection is always defined on above.
  public collection = '';
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) { }

  public listen(id: string): Observable<T | undefined> {
    return this.afs.collection<T>(this.collection).doc(id.toLowerCase()).valueChanges();
  }

  // TODO TokenPurchase | TokenBuySellOrder typings
  public calcVolume = (purchases: any[]) => purchases.reduce((sum, purchase) => sum + purchase.count, 0)

  // TODO TokenPurchase | TokenBuySellOrder typings
  public calcVWAP = (purchases: any[]) => {
    if (!purchases.length) {
      return 0
    }
    const high = purchases.reduce((max, act) => Math.max(max, act.price), Number.MIN_SAFE_INTEGER)
    const low = purchases.reduce((min, act) => Math.min(min, act.price), Number.MAX_SAFE_INTEGER)
    const close = purchases[0].price || 0
    const volume = this.calcVolume(purchases)
    const avg = (high + low + close) / 3
    return volume * avg / volume
  }

  public last(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<T[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def
    });
  }

  public top(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<T[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      search: search,
      def: def
    });
  }

  public alphabetical(lastValue?: number, search?: string, def = DEFAULT_LIST_SIZE): Observable<T[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'name',
      direction: 'asc',
      lastValue: lastValue,
      search: search,
      def: def
    });
  }

  protected _query(args: QueryArgs): Observable<T[]> {
    const { collection, orderBy = 'createdOn', direction = 'desc', lastValue, search, def = DEFAULT_LIST_SIZE, refCust } = args;
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

    return ref?.snapshotChanges().pipe(map((actions) => {
      // We need cursor.
      return actions.map(a => {
        const data = a.payload.doc.data();
        const doc = a.payload.doc;
        return { ...data, _doc: doc };
      });
    }));
  }

  public subCollectionMembers<T>(args: SubCollectionMembersArgs): Observable<T[]> {
    const { docId, subCol, lastValue, searchIds, manipulateOutput, orderBy = 'createdOn', direction = 'desc', def = DEFAULT_LIST_SIZE, refCust } = args;
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

    return ref.valueChanges().pipe(switchMap(async(obj: any[]) => {
      const out: T[] = [];
      const subRecords: T[] = await this.getSubRecordsInBatches(COL.MEMBER, obj.map((o) => {
        return o.uid;
      }));

      for (const o of obj) {
        const finObj: any = subRecords.find((subO: any) => {
          return subO.uid === o.uid;
        });

        // Add parent object.
        finObj._subColObj = o;
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

  public subCollectionMembersWithoutData<T>(args: SubCollectionMembersArgs): Observable<T[]> {
    const { docId, subCol, lastValue, searchIds, orderBy = 'createdOn', direction = 'desc', def = DEFAULT_LIST_SIZE, refCust } = args;
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

    return ref.valueChanges();
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
  protected topParent(args: TopParentArgs): Observable<any[]> {
    const { col, subCol, memberId, orderBy = 'createdOn', lastValue, def = DEFAULT_LIST_SIZE, refCust, frRef } = args;
    const ref: AngularFirestoreCollectionGroup = this.afs.collectionGroup(
      subCol,
      (ref: any) => {
        const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];
        let query: any = ref.where('uid', '==', memberId).where('parentCol', '==', col);
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
    return ref.valueChanges().pipe(switchMap(async(obj: any[]) => {
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
          if ((frRef && frRef(finObj, o)) || !frRef) {
            out.push(finObj);
          }
        }
      }

      return out;
    }));
  }

  protected request<T>(func: WEN_FUNC, req: any): Observable<T | undefined> {
    const callable = this.fns.httpsCallable(func);
    const data$ = callable(req);
    return data$;
  }
}
