import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
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
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
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
      refCust: (ref: any) => {
        return ref.where('uid', 'in', ids).where('type', '!=', TransactionType.ORDER);
      }
    });
  }
}
