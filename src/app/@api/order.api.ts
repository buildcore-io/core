import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Observable } from 'rxjs';
import { WEN_FUNC } from '../../../functions/interfaces/functions/index';
import { Transaction } from "../../../functions/interfaces/models";
import { COL, WenRequest } from '../../../functions/interfaces/models/base';
import { BaseApi } from './base.api';

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

  public validateAddress(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.validateAddress, req);
  }

  public openBid(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.openBid, req);
  }
}
