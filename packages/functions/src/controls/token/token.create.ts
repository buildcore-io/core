import { database } from '@buildcore/database';
import {
  Access,
  COL,
  SOON_PROJECT_ID,
  Token,
  TokenCreateRequest,
  TokenStatus,
  WenError,
} from '@buildcore/interfaces';
import { hasStakedTokens } from '../../services/stake.service';
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
    const tokens = await database().collection(COL.TOKEN).where('space', '==', space).get();
    const nonOrAllRejected = tokens.reduce(
      (acc, token) => acc && !token.approved && token.rejected,
      true,
    );
    if (!nonOrAllRejected) {
      throw invalidArgument(WenError.token_already_exists_for_space);
    }
    await assertIsGuardian(space, owner);
  }

  const symbolSnapshot = await database()
    .collection(COL.TOKEN)
    .where('symbol', '==', params.symbol)
    .where('rejected', '==', false)
    .get();
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
    : { saleStartDate: undefined, saleLength: undefined, coolDownEnd: undefined };

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
  const data: Token = {
    ...params,
    ...publicSaleTimeFrames,
    ...extraData,
    pricePerToken: params.pricePerToken || 0,
    allocations: params.allocations || [],
    links: (params.links || []).map((l) => new URL(l)),
    termsAndConditions: params.termsAndConditions || '',
    access: params.access as Access,
    ipfsMedia: '',
    ipfsMetadata: '',
  };
  await database().doc(COL.TOKEN, tokenUid).create(data);
  return (await database().doc(COL.TOKEN, tokenUid).get())!;
};
