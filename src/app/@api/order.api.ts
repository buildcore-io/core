import { Injectable } from '@angular/core';
import { Firestore, where } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { Observable } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { Transaction, TransactionType } from "../../../functions/interfaces/models";
import { COL, EthAddress, WenRequest } from '../../../functions/interfaces/models/base';
import { BaseApi, FULL_LIST } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class OrderApi extends BaseApi<Transaction> {
  public collection = COL.TRANSACTION;
  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
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
    return this._query({
      collection: this.collection,
      orderBy: ['type', 'createdOn'],
      direction: 'desc',
      def: FULL_LIST,
      constraints: [
        where('uid', 'in', ids),
        where('type', '!=', TransactionType.ORDER)
      ]
    });
  }
}
