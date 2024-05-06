import { database } from '@buildcore/database';
import {
  COL,
  StakeReward,
  StakeRewardStatus,
  TokenStakeRewardsRequest,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsTokenGuardian } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';

export const stakeRewardControl = async ({
  owner,
  params,
  project,
}: Context<TokenStakeRewardsRequest>) => {
  const tokenDocRef = database().doc(COL.TOKEN, params.token);
  const token = await tokenDocRef.get();
  if (!token) {
    throw invalidArgument(WenError.token_does_not_exist);
  }
  await assertIsTokenGuardian(token, owner);

  const stakeRewards = (params.items || []).map<StakeReward>((item) => ({
    project,
    uid: getRandomEthAddress(),
    startDate: dateToTimestamp(dayjs(item.startDate)),
    endDate: dateToTimestamp(dayjs(item.endDate)),
    tokenVestingDate: dateToTimestamp(dayjs(item.tokenVestingDate)),
    tokensToDistribute: item.tokensToDistribute,
    token: params.token,
    status: StakeRewardStatus.UNPROCESSED,
  }));

  const batch = database().batch();
  for (const stakeReward of stakeRewards) {
    const docRef = database().doc(COL.STAKE_REWARD, stakeReward.uid);
    batch.create(docRef, stakeReward);
  }
  await batch.commit();

  return stakeRewards;
};
