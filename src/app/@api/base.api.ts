import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { WEN_FUNC } from "functions/interfaces/functions";
import { COL, SUB_COL } from "functions/interfaces/models/base";
import { firstValueFrom, Observable, switchMap } from 'rxjs';

export const DEFAULT_LIST_SIZE = 50;

export class BaseApi<T> {
  // Collection is always defined on above.
  public collection = '';
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {}

  public listen(id: string): Observable<T|undefined> {
    return this.afs.collection<T>(this.collection).doc(id.toLowerCase()).valueChanges();
  }

  public last(lastValue?: any, def = DEFAULT_LIST_SIZE): Observable<T[]> {
    return this._query(this.collection, 'createdOn', 'asc', lastValue, def);
  }

  public top(lastValue?: any, def = DEFAULT_LIST_SIZE): Observable<T[]> {
    return this._query(this.collection, 'createdOn', 'desc', lastValue, def);
  }

  public lastByRank(lastValue?: any, def = DEFAULT_LIST_SIZE): Observable<T[]> {
    return this._query(this.collection, ['rank', 'createdOn'], 'desc', lastValue, def);
  }

  protected _query(collection: string, orderBy: string|string[] = 'createdOn', direction: any = 'desc', lastValue?: any, def = DEFAULT_LIST_SIZE): Observable<T[]> {
    const ref: AngularFirestoreCollection<T> = this.afs.collection<T>(
      collection,
      // We limit this to last record only. CreatedOn is always defined part of every record.
      (ref) => {
        const order: string[] = Array.isArray(orderBy) ? orderBy : [orderBy];
        let query: any = ref;
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
    return ref.valueChanges();
  }

  public subCollectionMembers<T>(
    docId: string,
    subCol: SUB_COL,
    lastValue?: any,
    manipulateOutput?: (original: any, finObj: any) => any,
    orderBy: string|string[] = 'createdOn',
    direction: any = 'desc',
    def = DEFAULT_LIST_SIZE
  ): Observable<T[]> {
    const ref: any = this.afs.collection(this.collection).doc(docId.toLowerCase()).collection(subCol, (subRef) => {
      let query: any = subRef;
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
      for (const o of obj) {
        const finObj: any = <any>await firstValueFrom(this.afs.collection(COL.MEMBER).doc(o.uid).valueChanges());
        if (manipulateOutput) {
          out.push(manipulateOutput(o, finObj));
        } else {
          out.push(finObj);
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
