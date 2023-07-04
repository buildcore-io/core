import { COL, SetTokenForSaleRequest, Token, TokenStatus, WenError } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian, assertTokenApproved, assertTokenStatus } from '../../utils/token.utils';
import { getPublicSaleTimeFrames, shouldSetPublicSaleTimeFrames } from './common';

export const setTokenAvailableForSaleControl = async (
  owner: string,
  params: SetTokenForSaleRequest,
) => {
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${params.token}`);

  await build5Db().runTransaction(async (transaction) => {
    const token = await transaction.get<Token>(tokenDocRef);
    if (!token) {
      throw invalidArgument(WenError.invalid_params);
    }

    assertTokenApproved(token);
    if (!token.public) {
      throw invalidArgument(WenError.token_must_be_public);
    }

    if (token.saleStartDate) {
      throw invalidArgument(WenError.public_sale_already_set);
    }

    assertTokenStatus(token, [TokenStatus.AVAILABLE]);

    await assertIsGuardian(token.space, owner);

    shouldSetPublicSaleTimeFrames({ ...params }, token.allocations);
    const timeFrames = getPublicSaleTimeFrames(
      dateToTimestamp(params.saleStartDate, true),
      params.saleLength,
      params.coolDownLength,
    );
    transaction.update(tokenDocRef, {
      ...timeFrames,
      autoProcessAt100Percent: params.autoProcessAt100Percent || false,
      pricePerToken: Number(params.pricePerToken),
    });
  });

  return await tokenDocRef.get<Token>();
};
