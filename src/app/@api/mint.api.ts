import { Injectable } from '@angular/core';
import { collection, collectionData, Firestore, limit, query, where } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { COL } from '@functions/interfaces/models/base';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MintApi {
  constructor(protected firestore: Firestore, protected functions: Functions) {
    // none.
  }

  public getAvailable(type: 'badge'|'avatar'): Observable<any[]> {
    return collectionData(
      query(
        collection(this.firestore, type === 'badge' ? COL.BADGES : COL.AVATARS),
        where('available', '==', true),
        limit(1)
      )
    );
  }
}
