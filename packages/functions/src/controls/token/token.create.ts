import { build5Db } from '@build-5/database';
import {
  COL,
  DEFAULT_NETWORK,
  SOON_PROJECT_ID,
  Space,
  Token,
  TokenCreateRequest,
  TokenStatus,
  WenError,
} from '@build-5/interfaces';
import { merge } from 'lodash';
import { hasStakedTokens } from '../../services/stake.service';
import { assertSpaceHasValidAddress } from '../../utils/address.utils';
import { isProdEnv } from '../../utils/config.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';
import { getPublicSaleTimeFrames, shouldSetPublicSaleTimeFrames } from './common';

export const createTokenControl = async ({
  project,
  owner,
  params,
}: Context<TokenCreateRequest>) => {
  const hasStakedSoons = await hasStakedTokens(project, owner);
  if (!hasStakedSoons) {
    throw invalidArgument(WenError.no_staked_soon);
  }

  const space = params.space || '';
  if (space) {
    const tokens = await build5Db().collection(COL.TOKEN).where('space', '==', space).get<Token>();
    const nonOrAllRejected = tokens.reduce(
      (acc, token) => acc && !token.approved && token.rejected,
      true,
    );
    if (!nonOrAllRejected) {
      throw invalidArgument(WenError.token_already_exists_for_space);
    }
    await assertIsGuardian(space, owner);

    const spaceData = await build5Db().doc(`${COL.SPACE}/${space}`).get<Space>();
    assertSpaceHasValidAddress(spaceData, DEFAULT_NETWORK);
  }

  const symbolSnapshot = await build5Db()
    .collection(COL.TOKEN)
    .where('symbol', '==', params.symbol)
    .where('rejected', '==', false)
    .get<Token>();
  if (symbolSnapshot.length > 0) {
    throw invalidArgument(WenError.token_symbol_must_be_globally_unique);
  }

  const publicSaleTimeFrames = shouldSetPublicSaleTimeFrames(
    { ...params },
    params.allocations || [],
  )
    ? getPublicSaleTimeFrames(
        dateToTimestamp(params.saleStartDate, true),
        params.saleLength || 0,
        params.coolDownLength || 0,
      )
    : {};

  const tokenUid = getRandomEthAddress();
  const extraData = {
    space,
    project,
    uid: tokenUid,
    createdBy: owner,
    approved: !isProdEnv(),
    rejected: false,
    public: project !== SOON_PROJECT_ID || !isProdEnv(),
    status: TokenStatus.AVAILABLE,
    ipfsMedia: null,
    ipfsMetadata: null,
    totalDeposit: 0,
    totalAirdropped: 0,
    tradingDisabled: true,
  };
  const data = merge(params, publicSaleTimeFrames, extraData);
  await build5Db().collection(COL.TOKEN).doc(tokenUid).set(data);
  return (await build5Db().doc(`${COL.TOKEN}/${tokenUid}`).get<Token>())!;
};
