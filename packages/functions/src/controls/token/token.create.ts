import {
  COL,
  DEFAULT_NETWORK,
  Space,
  Token,
  TokenAllocation,
  TokenStatus,
  WenError,
} from '@soonaverse/interfaces';
import { merge } from 'lodash';
import admin from '../../admin.config';
import { soonDb } from '../../database/wrapper/soondb';
import { hasStakedSoonTokens } from '../../services/stake.service';
import { assertSpaceHasValidAddress } from '../../utils/address.utils';
import { isProdEnv } from '../../utils/config.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { getPublicSaleTimeFrames, shouldSetPublicSaleTimeFrames } from './common';

export const createTokenControl = async (owner: string, params: Record<string, unknown>) => {
  const hasStakedSoons = await hasStakedSoonTokens(owner);
  if (!hasStakedSoons) {
    throw throwInvalidArgument(WenError.no_staked_soon);
  }

  const snapshot = await admin
    .firestore()
    .collection(COL.TOKEN)
    .where('space', '==', params.space)
    .get();
  const nonOrAllRejected = snapshot.docs.reduce(
    (sum, doc) => sum && !doc.data()?.approve && doc.data()?.rejected,
    true,
  );
  if (!nonOrAllRejected) {
    throw throwInvalidArgument(WenError.token_already_exists_for_space);
  }

  const symbolSnapshot = await admin
    .firestore()
    .collection(COL.TOKEN)
    .where('symbol', '==', params.symbol)
    .where('rejected', '==', false)
    .get();
  if (symbolSnapshot.size > 0) {
    throw throwInvalidArgument(WenError.token_symbol_must_be_globally_unique);
  }

  await assertIsGuardian(params.space as string, owner);

  const space = await soonDb().doc(`${COL.SPACE}/${params.space}`).get<Space>();
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
  await soonDb().collection(COL.TOKEN).doc(tokenUid).set(data);
  return await soonDb().doc(`${COL.TOKEN}/${tokenUid}`).get<Token>();
};
