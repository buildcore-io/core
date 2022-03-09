import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { COL } from '@functions/interfaces/models/base';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MintApi {
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    // none.
  }

  public getAvailable(type: 'badge'|'avatar'): Observable<any[]> {
    const ref: AngularFirestoreCollection<any> = this.afs.collection<any>(
      type === 'badge' ? COL.BADGES : COL.AVATARS,
      // We limit this to last record only. CreatedOn is always defined part of every record.
      (ref) => {
        return ref.where('available', '==', true).limit(1);
      }
    );
    return ref.valueChanges();
  }
}
