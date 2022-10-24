import { Injectable } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { COL, EthAddress, Transaction } from '@soon/interfaces';
import { Observable } from 'rxjs';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class TransactionApi extends BaseApi<Transaction> {
  public collection = COL.TRANSACTION;

  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }

  public listen(id: EthAddress): Observable<Transaction | undefined> {
    return super.listen(id);
  }
}
