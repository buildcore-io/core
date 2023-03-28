import { COL, Token, TokenStatus, WenError } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../firebase/firestore/soondb';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';

export const cancelPublicSaleControl = async (owner: string, params: Record<string, unknown>) => {
  const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${params.token}`);

  await soonDb().runTransaction(async (transaction) => {
    const token = await transaction.get<Token>(tokenDocRef);

    if (!token) {
      throw throwInvalidArgument(WenError.invalid_params);
    }

    if (!token.coolDownEnd || dayjs().add(30, 's').isAfter(dayjs(token.coolDownEnd.toDate()))) {
      throw throwInvalidArgument(WenError.no_token_public_sale);
    }

    await assertIsGuardian(token.space, owner);

    transaction.update(tokenDocRef, {
      saleStartDate: soonDb().deleteField(),
      saleLength: soonDb().deleteField(),
      coolDownEnd: soonDb().deleteField(),
      status: TokenStatus.CANCEL_SALE,
      totalDeposit: 0,
    });
  });

  return await tokenDocRef.get<Token>();
};
