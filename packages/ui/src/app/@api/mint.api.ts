import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  collection,
  collectionData,
  Firestore,
  limit,
  query,
  where,
} from '@angular/fire/firestore';
import { COL } from '@soonaverse/interfaces';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MintApi {
  constructor(protected firestore: Firestore, protected httpClient: HttpClient) {
    // none.
  }

  public getAvailable(type: 'badge' | 'avatar'): Observable<any[]> {
    return collectionData(
      query(
        collection(this.firestore, type === 'badge' ? COL.BADGES : COL.AVATARS),
        where('available', '==', true),
        limit(1),
      ),
    );
  }
}
