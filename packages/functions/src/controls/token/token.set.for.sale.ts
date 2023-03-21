import { COL, Token, TokenStatus, WenError } from '@soonaverse/interfaces';
import { soonDb } from '../../database/wrapper/soondb';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsGuardian, assertTokenApproved, assertTokenStatus } from '../../utils/token.utils';
import { getPublicSaleTimeFrames, shouldSetPublicSaleTimeFrames } from './common';

export const setTokenAvailableForSaleControl = async (
  owner: string,
  params: Record<string, unknown>,
) => {
  const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${params.token}`);

  await soonDb().runTransaction(async (transaction) => {
    const token = await transaction.get<Token>(tokenDocRef);
    if (!token) {
      throw throwInvalidArgument(WenError.invalid_params);
    }

    assertTokenApproved(token);
    if (!token.public) {
      throw throwInvalidArgument(WenError.token_must_be_public);
    }

    if (token.saleStartDate) {
      throw throwInvalidArgument(WenError.public_sale_already_set);
    }

    assertTokenStatus(token, [TokenStatus.AVAILABLE]);

    await assertIsGuardian(token.space, owner);

    shouldSetPublicSaleTimeFrames(params, token.allocations);
    const timeFrames = getPublicSaleTimeFrames(
      dateToTimestamp(params.saleStartDate as Date, true),
      params.saleLength as number,
      params.coolDownLength as number,
    );
    transaction.update(tokenDocRef, {
      ...timeFrames,
      autoProcessAt100Percent: params.autoProcessAt100Percent || false,
      pricePerToken: Number(params.pricePerToken),
    });
  });

  return await tokenDocRef.get<Token>();
};
