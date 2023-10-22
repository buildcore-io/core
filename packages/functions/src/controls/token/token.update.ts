import { build5Db } from '@build-5/database';
import { COL, Token, TokenStatus, WenError } from '@build-5/interfaces';
import { invalidArgument } from '../../utils/error.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { assertIsGuardian, assertTokenStatus } from '../../utils/token.utils';
import { Context, UidSchemaObject } from '../common';
import {
  updateTokenSchemaObject,
  uptdateMintedTokenSchemaObject,
} from './TokenUpdateRequestSchema';

export const updateTokenControl = async ({ owner, params }: Context<UidSchemaObject>) => {
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${params.uid}`);
  await build5Db().runTransaction(async (transaction) => {
    const token = await transaction.get<Token>(tokenDocRef);
    if (!token) {
      throw invalidArgument(WenError.invalid_params);
    }

    const schema =
      token.status === TokenStatus.MINTED
        ? uptdateMintedTokenSchemaObject
        : updateTokenSchemaObject;
    await assertValidationAsync(schema, params);

    assertTokenStatus(token, [TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED, TokenStatus.MINTED]);
    await assertIsGuardian(token.space, owner);

    transaction.update(tokenDocRef, params);
  });

  return await tokenDocRef.get<Token>();
};
