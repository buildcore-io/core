import { Injectable } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import {
  COL,
  MIN_AMOUNT_TO_TRANSFER,
  StakeReward,
  StakeRewardStatus,
  StakeType,
  TokenStats,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { where } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { BaseApi, DEFAULT_LIST_SIZE } from './base.api';

@Injectable({
  providedIn: 'root',
})
export class StakeRewardApi extends BaseApi<StakeReward> {
  public collection = COL.STAKE_REWARD;

  constructor(protected firestore: Firestore, protected functions: Functions) {
    super(firestore, functions);
  }

  /**
      "<total staked value of the user>/<total staked value for the token> = % they own

      % they own * <total vailable tokens in next 52 weeks> = total tokens earn in one year

      <total tokens earn in one year> / <total staked user stakes>"
  */
  public calcApy(
    tokenStats: TokenStats,
    memberStakeAmount: number,
    rewards: StakeReward[],
  ): number {
    const totalFutureRewards = rewards
      .filter((v) => {
        return (
          v.status === StakeRewardStatus.UNPROCESSED &&
          dayjs().add(52, 'weeks').isAfter(v.endDate.toDate())
        );
      })
      .reduce((acc, act) => acc + act.tokensToDistribute, 0);

    if (totalFutureRewards < MIN_AMOUNT_TO_TRANSFER) {
      return 0;
    }
    let multiplier =
      memberStakeAmount /
      ((tokenStats.stakes?.[StakeType.DYNAMIC]?.value || 0) + memberStakeAmount);
    if (multiplier > 1) {
      multiplier = 1;
    }

    const potentialEarnedTokens = multiplier * totalFutureRewards;
    return potentialEarnedTokens / memberStakeAmount;
  }

  public token(
    token: string,
    lastValue?: number,
    def = DEFAULT_LIST_SIZE,
  ): Observable<StakeReward[]> {
    return this._query({
      collection: this.collection,
      orderBy: 'endDate',
      direction: 'asc',
      lastValue: lastValue,
      def: def,
      constraints: [where('token', '==', token)],
    });
  }

  public submit(req: WenRequest): Observable<StakeReward[] | undefined> {
    return this.request(WEN_FUNC.stakeReward, req);
  }
}
