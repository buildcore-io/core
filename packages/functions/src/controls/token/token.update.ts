import { PgTokenUpdate, database } from '@buildcore/database';
import { COL, TokenStatus, WenError } from '@buildcore/interfaces';
import { invalidArgument } from '../../utils/error.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { assertIsTokenGuardian, assertTokenStatus } from '../../utils/token.utils';
import { Context, UidSchemaObject } from '../common';
import {
  updateTokenSchemaObject,
  uptdateMintedTokenSchemaObject,
} from './TokenUpdateRequestSchema';

export const updateTokenControl = async ({ owner, params }: Context<UidSchemaObject>) => {
  const tokenDocRef = database().doc(COL.TOKEN, params.uid);
  await database().runTransaction(async (transaction) => {
    const token = await transaction.get(tokenDocRef);
    if (!token) {
      throw invalidArgument(WenError.invalid_params);
    }

    const schema =
      token.status === TokenStatus.MINTED
        ? uptdateMintedTokenSchemaObject
        : updateTokenSchemaObject;
    await assertValidationAsync(schema, params);

    assertTokenStatus(token, [TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED, TokenStatus.MINTED]);
    await assertIsTokenGuardian(token, owner);

    await transaction.update(tokenDocRef, params as PgTokenUpdate);
  });

  return await tokenDocRef.get();
};
