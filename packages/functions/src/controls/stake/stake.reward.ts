import { build5Db } from '@build-5/database';
import {
  COL,
  StakeReward,
  StakeRewardStatus,
  Token,
  TokenStakeRewardsRequest,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const stakeRewardControl = async (owner: string, params: TokenStakeRewardsRequest) => {
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${params.token}`);
  const token = await tokenDocRef.get<Token>();
  if (!token) {
    throw invalidArgument(WenError.token_does_not_exist);
  }
  await assertIsGuardian(token.space, owner);

  const stakeRewards = (params.items || []).map<StakeReward>((item) => ({
    uid: getRandomEthAddress(),
    startDate: dateToTimestamp(dayjs(item.startDate)),
    endDate: dateToTimestamp(dayjs(item.endDate)),
    tokenVestingDate: dateToTimestamp(dayjs(item.tokenVestingDate)),
    tokensToDistribute: item.tokensToDistribute,
    token: params.token,
    status: StakeRewardStatus.UNPROCESSED,
  }));

  const batch = build5Db().batch();
  stakeRewards.forEach((stakeReward) => {
    const docRef = build5Db().doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`);
    batch.create(docRef, stakeReward);
  });
  await batch.commit();

  return stakeRewards;
};
