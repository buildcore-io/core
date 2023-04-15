import { HttpClient } from '@angular/common/http';
import {
  Firestore,
  QueryConstraint,
  collection as coll,
  collectionData,
  collectionGroup,
  doc,
  docData,
  getDocs,
  limit,
  orderBy as ordBy,
  query,
  startAfter,
  where,
} from '@angular/fire/firestore';
import { environment } from '@env/environment';
import {
  COL,
  EthAddress,
  SOON_PROD_ADDRESS_API,
  SOON_TEST_ADDRESS_API,
  SUB_COL,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import { collection as colquery } from 'rxfire/firestore';
import { Observable, combineLatest, map, switchMap } from 'rxjs';

export const DEFAULT_LIST_SIZE = 50;
export const WHERE_IN_BATCH = 10;
export const FULL_LIST = 10000;
// TODO Migrations that should happen.
export const FULL_TODO_CHANGE_TO_PAGING = FULL_LIST;
export const FULL_TODO_MOVE_TO_PROTOCOL = FULL_LIST;

export interface FbRef {
  (ref: any, ref2: any): any;
}

export interface QueryArgs {
  collection: string;
  orderBy?: string | string[];
  direction?: any;
  lastValue?: number;
  def?: number;
  constraints?: QueryConstraint[];
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
  constraints?: QueryConstraint[];
}

export interface TopParentArgs {
  col: COL;
  subCol: SUB_COL;
  memberId: EthAddress;
  orderBy?: string | string[];
  lastValue?: number;
  def?: number;
  constraints?: QueryConstraint[];
  frRef?: FbRef;
}

export class BaseApi<T> {
  // Collection is always defined on above.
  public collection = '';

  constructor(protected firestore: Firestore, protected httpClient: HttpClient) {}

  public listen(id: string): Observable<T | undefined> {
    return docData(doc(this.firestore, this.collection, id.toLowerCase())) as Observable<
      T | undefined
    >;
  }

  // TODO TokenPurchase | TokenTradeOrder typings
  public calcVolume = (purchases: any[]) =>
    purchases.reduce((sum, purchase) => sum + purchase.count, 0);

  // TODO TokenPurchase | TokenTradeOrder typings
  public calcVWAP = (purchases: any[]) => {
    if (!purchases.length) {
      return 0;
    }

    // Ignore purchase with flag ignoreVWAP = true (this was due historal bug)
    // TODO Remove this in the future.
    purchases = purchases.filter((v) => {
      return v.ignoreVWAP !== true;
    });

    const high = purchases.reduce((max, act) => Math.max(max, act.price), Number.MIN_SAFE_INTEGER);
    const low = purchases.reduce((min, act) => Math.min(min, act.price), Number.MAX_SAFE_INTEGER);
    const close = purchases[0].price || 0;
    const volume = this.calcVolume(purchases);
    const avg = (high + low + close) / 3;
    return (volume * avg) / volume;
  };

  public listenMultiple(ids: EthAddress[]): Observable<T[]> {
    const streams: Observable<T[]>[] = [];
    for (let i = 0, j = ids.length; i < j; i += WHERE_IN_BATCH) {
      const batchToGet: string[] = ids.slice(i, i + WHERE_IN_BATCH);
      streams.push(
        this._query({
          collection: this.collection,
          orderBy: 'createdOn',
          direction: 'desc',
          constraints: [where('uid', 'in', batchToGet)],
        }),
      );
    }
    return combineLatest(streams).pipe(
      map((o) => {
        return o.flat(1);
      }),
    );
  }

  public last(lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<T[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'asc',
      lastValue: lastValue,
      def: def,
    });
  }

  public top(lastValue?: number, def = DEFAULT_LIST_SIZE): Observable<T[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'createdOn',
      direction: 'desc',
      lastValue: lastValue,
      def: def,
    });
  }

  protected _query(args: QueryArgs): Observable<T[]> {
    const {
      collection,
      orderBy = 'createdOn',
      direction = 'desc',
      lastValue,
      def = DEFAULT_LIST_SIZE,
      constraints = [],
    } = args;
    const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];

    order.forEach((o) => {
      constraints.push(ordBy(o, direction));
    });

    if (lastValue) {
      constraints.push(startAfter(lastValue));
    }

    constraints.push(limit(def));

    const changes = colquery(query(coll(this.firestore, collection), ...constraints)).pipe(
      map((obj) => {
        const optimized: any[] = <any>[];
        obj.forEach((o) => {
          optimized.push({
            ...o.data(),
            _doc: o,
          });
        });

        return optimized;
      }),
    );

    return changes as Observable<T[]>;
  }

  public subCollectionMembers<T>(args: SubCollectionMembersArgs): Observable<T[]> {
    const {
      docId,
      subCol,
      lastValue,
      searchIds,
      manipulateOutput,
      orderBy = 'createdOn',
      direction = 'desc',
      def = DEFAULT_LIST_SIZE,
      constraints = [],
    } = args;
    const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];

    if (searchIds && searchIds.length > 0) {
      constraints.push(where('uid', 'in', searchIds));
    }

    order.forEach((o) => {
      constraints.push(ordBy(o, direction));
    });

    if (lastValue) {
      constraints.push(startAfter(lastValue));
    }

    constraints.push(limit(def));

    const changes = collectionData(
      query(coll(this.firestore, this.collection, docId.toLowerCase(), subCol), ...constraints),
    );

    return changes.pipe(
      switchMap(async (obj: any[]) => {
        const out: T[] = [];
        const subRecords: T[] = await this.getSubRecordsInBatches(
          COL.MEMBER,
          obj.map((o) => {
            return o.uid;
          }),
        );
        for (const o of obj) {
          const finObj: any = subRecords.find((subO: any) => {
            return subO.uid === o.uid;
          });
          if (!finObj) continue;
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
      }),
    );
  }

  public subCollectionMembersWithoutData<T>(args: SubCollectionMembersArgs): Observable<T[]> {
    const {
      docId,
      subCol,
      lastValue,
      searchIds,
      orderBy = 'createdOn',
      direction = 'desc',
      def = DEFAULT_LIST_SIZE,
      constraints = [],
    } = args;
    const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];

    if (searchIds && searchIds.length > 0) {
      constraints.push(where('uid', 'in', searchIds));
    }

    order.forEach((o) => {
      constraints.push(ordBy(o, direction));
    });

    if (lastValue) {
      constraints.push(startAfter(lastValue));
    }

    constraints.push(limit(def));

    const changes = collectionData(
      query(coll(this.firestore, this.collection, docId.toLowerCase(), subCol), ...constraints),
    );

    return changes as Observable<T[]>;
  }

  protected async getSubRecordsInBatches(col: COL, records: string[]): Promise<any[]> {
    const out: any = [];
    for (let i = 0, j = records.length; i < j; i += WHERE_IN_BATCH) {
      const batchToGet: string[] = records.slice(i, i + WHERE_IN_BATCH);
      const qr: any = await getDocs(
        query(coll(this.firestore, col), where('uid', 'in', batchToGet)),
      );
      for (const doc of qr.docs) {
        out.push(doc.data());
      }
    }

    return out;
  }

  // TODO Implement proper typings.
  protected topParent(args: TopParentArgs): Observable<any[]> {
    const {
      col,
      subCol,
      memberId,
      orderBy = 'createdOn',
      lastValue,
      def = DEFAULT_LIST_SIZE,
      constraints = [],
      frRef,
    } = args;

    const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];
    constraints.push(where('uid', '==', memberId));
    constraints.push(where('parentCol', '==', col));

    order.forEach((o) => {
      constraints.push(ordBy(o, 'desc'));
    });

    if (lastValue) {
      constraints.push(startAfter(lastValue));
    }

    constraints.push(limit(def));

    return collectionData(query(collectionGroup(this.firestore, subCol), ...constraints)).pipe(
      switchMap(async (obj: any[]) => {
        const out: any[] = [];
        if (obj.length === 0) {
          return out;
        }

        const subRecords: T[] = await this.getSubRecordsInBatches(
          col,
          obj.map((o) => {
            return o.parentId;
          }),
        );

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
      }),
    );
  }

  protected request<T>(func: WEN_FUNC, req: any): Observable<T | undefined> {
    let url = '';
    if (environment.production) {
      url = SOON_PROD_ADDRESS_API;
    } else {
      url = SOON_TEST_ADDRESS_API;
    }

    const functionKey = Object.entries(WEN_FUNC).find((v) => {
      return v[1] === <any>func;
    });

    // Add function
    url += `post${functionKey![0][0].toUpperCase() + functionKey![0].slice(1)}`;
    return this.httpClient
      .post(url, {
        data: req,
      })
      .pipe(
        map((b: any) => {
          return b.data;
        }),
      );
  }
}
