import { Injectable } from '@angular/core';
import { doc, docData, Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { COL, Ticker } from '@soon/interfaces';
import { Observable } from 'rxjs';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class TickerApi extends BaseApi<Ticker> {
  public collection = COL.TICKER;

  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }

  public listen(id: string): Observable<Ticker | undefined> {
    return docData(doc(this.firestore, this.collection, id)) as Observable<Ticker | undefined>;
  }
}
