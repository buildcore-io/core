import { COL, StakeReward, StakeRewardStatus, Token, WenError } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../firebase/firestore/soondb';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

interface StakeRewardItem {
  readonly startDate: number;
  readonly endDate: number;
  readonly tokenVestingDate: number;
  readonly tokensToDistribute: number;
}

export const stakeRewardControl = async (owner: string, params: Record<string, unknown>) => {
  const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${params.token}`);
  const token = await tokenDocRef.get<Token>();
  if (!token) {
    throw invalidArgument(WenError.token_does_not_exist);
  }
  await assertIsGuardian(token.space, owner);

  const stakeRewards = (params.items as StakeRewardItem[]).map<StakeReward>((item) => ({
    uid: getRandomEthAddress(),
    startDate: dateToTimestamp(dayjs(item.startDate)),
    endDate: dateToTimestamp(dayjs(item.endDate)),
    tokenVestingDate: dateToTimestamp(dayjs(item.tokenVestingDate)),
    tokensToDistribute: item.tokensToDistribute,
    token: params.token as string,
    status: StakeRewardStatus.UNPROCESSED,
  }));

  const batch = soonDb().batch();
  stakeRewards.forEach((stakeReward) => {
    const docRef = soonDb().doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`);
    batch.create(docRef, stakeReward);
  });
  await batch.commit();

  return stakeRewards;
};
