import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { map, Observable } from 'rxjs';

export class BaseApi<T> {
  // Collection is always defined on above.
  public collection = '';
  constructor(protected afs: AngularFirestore) {}

  public listen(id: string): Observable<T|undefined> {
    return this.afs.collection<T>(this.collection).doc(id.toLowerCase()).valueChanges();
  }

  public latest(): Observable<T> {
    const ref: AngularFirestoreCollection<T> = this.afs.collection<T>(
      this.collection,
      // We limit this to last record only. CreatedOn is always defined part of every record.
      (ref) => {
        return ref.orderBy('createdOn', 'asc').limitToLast(1);
      }
    );
    return ref.valueChanges().pipe(
      map((arr) => {
        return arr[0];
      })
    );
  }

  public last(def = 50): Observable<T[]> {
    // Will need to change to desc
    return this._query(this.collection, 'createdOn', 'asc', def);
  }

  public top(def = 50): Observable<T[]> {
    return this._query(this.collection, 'createdOn', 'desc', def);
  }

  public lastByRank(def = 50): Observable<T[]> {
    return this._query(this.collection, 'rank', 'desc', def);
  }

  protected _query(collection: string, orderBy = 'createdOn', direction: any = 'desc', def = 50): Observable<T[]> {
    const ref: AngularFirestoreCollection<T> = this.afs.collection<T>(
      collection,
      // We limit this to last record only. CreatedOn is always defined part of every record.
      (ref) => {
        return ref.orderBy(orderBy, direction).limitToLast(def);
      }
    );
    return ref.valueChanges();
  }
}
