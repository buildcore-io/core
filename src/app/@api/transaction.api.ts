import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Transaction } from "functions/interfaces/models";
import { Observable } from 'rxjs';
import { COL, EthAddress } from '../../../functions/interfaces/models/base';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class TransactionApi extends BaseApi<Transaction> {
  public collection = COL.SPACE;
  constructor(protected afs: AngularFirestore, protected fns: AngularFireFunctions) {
    super(afs, fns);
  }

  public listen(id: EthAddress): Observable<Transaction|undefined> {
    return super.listen(id);
  }
}
