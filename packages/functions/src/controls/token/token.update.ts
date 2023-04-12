import { COL, Token, TokenStatus, WenError } from '@soonaverse/interfaces';
import Joi from 'joi';
import { soonDb } from '../../firebase/firestore/soondb';
import { updateTokenSchema, uptdateMintedTokenSchema } from '../../runtime/firebase/token/base';
import { invalidArgument } from '../../utils/error.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { assertIsGuardian, assertTokenStatus } from '../../utils/token.utils';

export const updateTokenControl = async (owner: string, params: Record<string, unknown>) => {
  const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${params.uid}`);
  await soonDb().runTransaction(async (transaction) => {
    const token = await transaction.get<Token>(tokenDocRef);
    if (!token) {
      throw invalidArgument(WenError.invalid_params);
    }

    const schema =
      token.status === TokenStatus.MINTED ? uptdateMintedTokenSchema : updateTokenSchema;
    await assertValidationAsync(Joi.object(schema), params);

    assertTokenStatus(token, [TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED, TokenStatus.MINTED]);
    await assertIsGuardian(token.space, owner);

    transaction.update(tokenDocRef, params);
  });

  return await tokenDocRef.get<Token>();
};
