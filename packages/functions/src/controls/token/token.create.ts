import {
  COL,
  DEFAULT_NETWORK,
  Space,
  Token,
  TokenAllocation,
  TokenStatus,
  WenError,
} from '@build-5/interfaces';
import { merge } from 'lodash';
import { build5Db } from '../../firebase/firestore/build5Db';
import { hasStakedSoonTokens } from '../../services/stake.service';
import { assertSpaceHasValidAddress } from '../../utils/address.utils';
import { isProdEnv } from '../../utils/config.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { getPublicSaleTimeFrames, shouldSetPublicSaleTimeFrames } from './common';

export const createTokenControl = async (owner: string, params: Record<string, unknown>) => {
  const hasStakedSoons = await hasStakedSoonTokens(owner);
  if (!hasStakedSoons) {
    throw invalidArgument(WenError.no_staked_soon);
  }

  const tokens = await build5Db()
    .collection(COL.TOKEN)
    .where('space', '==', params.space)
    .get<Token>();
  const nonOrAllRejected = tokens.reduce(
    (acc, token) => acc && !token.approved && token.rejected,
    true,
  );
  if (!nonOrAllRejected) {
    throw invalidArgument(WenError.token_already_exists_for_space);
  }

  const symbolSnapshot = await build5Db()
    .collection(COL.TOKEN)
    .where('symbol', '==', params.symbol)
    .where('rejected', '==', false)
    .get<Token>();
  if (symbolSnapshot.length > 0) {
    throw invalidArgument(WenError.token_symbol_must_be_globally_unique);
  }

  await assertIsGuardian(params.space as string, owner);

  const space = await build5Db().doc(`${COL.SPACE}/${params.space}`).get<Space>();
  assertSpaceHasValidAddress(space, DEFAULT_NETWORK);

  const publicSaleTimeFrames = shouldSetPublicSaleTimeFrames(
    params,
    params.allocations as TokenAllocation[],
  )
    ? getPublicSaleTimeFrames(
        dateToTimestamp(params.saleStartDate as Date, true),
        params.saleLength as number,
        params.coolDownLength as number,
      )
    : {};

  const tokenUid = getRandomEthAddress();
  const extraData = {
    uid: tokenUid,
    createdBy: owner,
    approved: !isProdEnv(),
    rejected: false,
    public: !isProdEnv(),
    status: TokenStatus.AVAILABLE,
    ipfsMedia: null,
    ipfsMetadata: null,
    totalDeposit: 0,
    totalAirdropped: 0,
    tradingDisabled: true,
  };
  const data = merge(params, publicSaleTimeFrames, extraData);
  await build5Db().collection(COL.TOKEN).doc(tokenUid).set(data);
  return await build5Db().doc(`${COL.TOKEN}/${tokenUid}`).get<Token>();
};
