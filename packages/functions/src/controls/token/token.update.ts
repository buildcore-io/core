import {
  COL,
  MintedTokenUpdateRequest,
  Token,
  TokenStatus,
  TokenUpdateRequest,
  WenError,
} from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { UidSchemaObject } from '../../runtime/firebase/common';
import { updateTokenSchema, uptdateMintedTokenSchema } from '../../runtime/firebase/token/base';
import { toJoiObject } from '../../services/joi/common';
import { invalidArgument } from '../../utils/error.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { assertIsGuardian, assertTokenStatus } from '../../utils/token.utils';

export const updateTokenControl = async (owner: string, params: UidSchemaObject) => {
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${params.uid}`);
  await build5Db().runTransaction(async (transaction) => {
    const token = await transaction.get<Token>(tokenDocRef);
    if (!token) {
      throw invalidArgument(WenError.invalid_params);
    }

    const schema =
      token.status === TokenStatus.MINTED
        ? toJoiObject<MintedTokenUpdateRequest>(uptdateMintedTokenSchema)
        : toJoiObject<TokenUpdateRequest>(updateTokenSchema);
    await assertValidationAsync(schema, params);

    assertTokenStatus(token, [TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED, TokenStatus.MINTED]);
    await assertIsGuardian(token.space, owner);

    transaction.update(tokenDocRef, params);
  });

  return await tokenDocRef.get<Token>();
};
