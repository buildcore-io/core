import { database } from '@buildcore/database';
import { COL, CanelPublicSaleRequest, TokenStatus, WenError } from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsTokenGuardian } from '../../utils/token.utils';
import { Context } from '../common';

export const cancelPublicSaleControl = async ({
  owner,
  params,
}: Context<CanelPublicSaleRequest>) => {
  const tokenDocRef = database().doc(COL.TOKEN, params.token);

  await database().runTransaction(async (transaction) => {
    const token = await transaction.get(tokenDocRef);

    if (!token) {
      throw invalidArgument(WenError.invalid_params);
    }

    if (!token.coolDownEnd || dayjs().add(30, 's').isAfter(dayjs(token.coolDownEnd.toDate()))) {
      throw invalidArgument(WenError.no_token_public_sale);
    }

    await assertIsTokenGuardian(token, owner);

    await transaction.update(tokenDocRef, {
      saleStartDate: undefined,
      saleLength: undefined,
      coolDownEnd: undefined,
      status: TokenStatus.CANCEL_SALE,
      totalDeposit: 0,
    });
  });

  return (await tokenDocRef.get())!;
};
