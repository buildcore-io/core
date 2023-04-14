import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { COL, EthAddress, Transaction, WEN_FUNC, WenRequest } from '@soonaverse/interfaces';
import { Observable } from 'rxjs';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class TransactionApi extends BaseApi<Transaction> {
  public collection = COL.TRANSACTION;

  constructor(protected firestore: Firestore, protected httpClient: HttpClient) {
    super(firestore, httpClient);
  }

  public listen(id: EthAddress): Observable<Transaction | undefined> {
    return super.listen(id);
  }

  public creditUnrefundable(req: WenRequest): Observable<Transaction | undefined> {
    return this.request(WEN_FUNC.creditUnrefundable, req);
  }
}
