import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { map, Observable } from 'rxjs';

export class BaseApi<T> {
  // Collection is always defined on above.
  public collection = '';
  constructor(protected afs: AngularFirestore) {}

  public get(id: string): Observable<T|undefined> {
    return this.afs.collection<T>(this.collection).doc(id).valueChanges();
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
}
