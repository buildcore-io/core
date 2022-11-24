import { Injectable } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { COL, StakeReward } from '@soonaverse/interfaces';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class StakeRewardApi extends BaseApi<StakeReward> {
  public collection = COL.STAKE_REWARD;

  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }
}
