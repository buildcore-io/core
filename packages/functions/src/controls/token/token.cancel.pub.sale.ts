import { build5Db } from '@build-5/database';
import { COL, CanelPublicSaleRequest, Token, TokenStatus, WenError } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { Context } from '../common';

export const cancelPublicSaleControl = async ({
  owner,
  params,
}: Context<CanelPublicSaleRequest>) => {
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${params.token}`);

  await build5Db().runTransaction(async (transaction) => {
    const token = await transaction.get<Token>(tokenDocRef);

    if (!token) {
      throw invalidArgument(WenError.invalid_params);
    }

    if (!token.coolDownEnd || dayjs().add(30, 's').isAfter(dayjs(token.coolDownEnd.toDate()))) {
      throw invalidArgument(WenError.no_token_public_sale);
    }

    await assertIsGuardian(token.space, owner);

    transaction.update(tokenDocRef, {
      saleStartDate: build5Db().deleteField(),
      saleLength: build5Db().deleteField(),
      coolDownEnd: build5Db().deleteField(),
      status: TokenStatus.CANCEL_SALE,
      totalDeposit: 0,
    });
  });

  return (await tokenDocRef.get<Token>())!;
};
