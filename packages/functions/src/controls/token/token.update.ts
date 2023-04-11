import { COL, Token, TokenStatus, WenError } from '@soonaverse/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian, assertTokenStatus } from '../../utils/token.utils';

export const updateTokenControl = async (owner: string, params: Record<string, unknown>) => {
  const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${params.uid}`);
  await soonDb().runTransaction(async (transaction) => {
    const token = await transaction.get<Token>(tokenDocRef);
    if (!token) {
      throw invalidArgument(WenError.invalid_params);
    }

    assertTokenStatus(token, [TokenStatus.AVAILABLE]);
    await assertIsGuardian(token.space, owner);

    transaction.update(tokenDocRef, params);
  });

  return await tokenDocRef.get<Token>();
};
