import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Firestore, where } from '@angular/fire/firestore';
import {
  COL,
  EthAddress,
  Transaction,
  TransactionType,
  WEN_FUNC,
  WenRequest,
} from '@soonaverse/interfaces';
import { Observable, combineLatest, map } from 'rxjs';
import { BaseApi, WHERE_IN_BATCH } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class OrderApi extends BaseApi<Transaction> {
  public collection = COL.TRANSACTION;

  constructor(protected firestore: Firestore, protected httpClient: HttpClient) {
    super(firestore, httpClient);
  }

  public orderNft(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.orderNft, req);
  }

  public orderToken(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.orderToken, req);
  }

  public validateAddress(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.validateAddress, req);
  }

  public openBid(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.openBid, req);
  }

  public listenMultiple(ids: EthAddress[]): Observable<Transaction[]> {
    const streams: Observable<Transaction[]>[] = [];
    for (let i = 0, j = ids.length; i < j; i += WHERE_IN_BATCH) {
      const batchToGet: string[] = ids.slice(i, i + WHERE_IN_BATCH);
      streams.push(
        this._query({
          collection: this.collection,
          orderBy: ['type', 'createdOn'],
          direction: 'desc',
          constraints: [where('uid', 'in', batchToGet), where('type', '!=', TransactionType.ORDER)],
        }),
      );
    }
    return combineLatest(streams).pipe(
      map((o) => {
        return o.flat(1);
      }),
    );
  }
}
