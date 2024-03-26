import { build5Db } from '@build-5/database';
import {
  COL,
  DEFAULT_NETWORK,
  SetTokenForSaleRequest,
  TokenStatus,
  WenError,
} from '@build-5/interfaces';
import { assertSpaceHasValidAddress } from '../../utils/address.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import {
  assertIsTokenGuardian,
  assertTokenApproved,
  assertTokenStatus,
} from '../../utils/token.utils';
import { Context } from '../common';
import { getPublicSaleTimeFrames, shouldSetPublicSaleTimeFrames } from './common';

export const setTokenAvailableForSaleControl = async ({
  owner,
  params,
}: Context<SetTokenForSaleRequest>) => {
  const tokenDocRef = build5Db().doc(COL.TOKEN, params.token);

  await build5Db().runTransaction(async (transaction) => {
    const token = await transaction.get(tokenDocRef);

    if (!token) {
      throw invalidArgument(WenError.token_does_not_exist);
    }

    if (!token.space) {
      throw invalidArgument(WenError.token_must_have_space);
    }

    const spaceData = await build5Db().doc(COL.SPACE, token.space).get();
    assertSpaceHasValidAddress(spaceData, DEFAULT_NETWORK);

    assertTokenApproved(token);
    if (!token.public) {
      throw invalidArgument(WenError.token_must_be_public);
    }

    if (token.saleStartDate) {
      throw invalidArgument(WenError.public_sale_already_set);
    }

    assertTokenStatus(token, [TokenStatus.AVAILABLE]);

    await assertIsTokenGuardian(token, owner);

    shouldSetPublicSaleTimeFrames({ ...params }, token.allocations);
    const timeFrames = getPublicSaleTimeFrames(
      dateToTimestamp(params.saleStartDate, true),
      params.saleLength,
      params.coolDownLength,
    );
    await transaction.update(tokenDocRef, {
      ...timeFrames,
      saleStartDate: timeFrames.saleStartDate?.toDate(),
      coolDownEnd: timeFrames.coolDownEnd?.toDate(),
      autoProcessAt100Percent: params.autoProcessAt100Percent || false,
      pricePerToken: Number(params.pricePerToken),
    });
  });

  return await tokenDocRef.get();
};
