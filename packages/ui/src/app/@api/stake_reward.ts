import { Injectable } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { COL, StakeReward, WenRequest, WEN_FUNC } from '@soonaverse/interfaces';
import { Observable } from 'rxjs';
import { BaseApi } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class StakeRewardApi extends BaseApi<StakeReward> {
  public collection = COL.STAKE_REWARD;

  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }

  public submit(req: WenRequest): Observable<StakeReward[] | undefined> {
    return this.request(WEN_FUNC.stakeReward, req);
  }
}
