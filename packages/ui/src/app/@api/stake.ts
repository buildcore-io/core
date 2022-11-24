import { Injectable } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { COL, Stake } from '@soonaverse/interfaces';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class StakeApi extends BaseApi<Stake> {
  public collection = COL.STAKE;

  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }
}
