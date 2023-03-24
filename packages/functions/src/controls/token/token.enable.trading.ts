import { COL, Token, WenError } from '@soonaverse/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';

export const enableTokenTradingControl = async (owner: string, params: Record<string, unknown>) => {
  const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${params.uid}`);
  const token = await tokenDocRef.get<Token>();
  if (!token) {
    throw throwInvalidArgument(WenError.token_does_not_exist);
  }

  if (!token.public) {
    throw throwInvalidArgument(WenError.token_must_be_public);
  }

  await assertIsGuardian(token.space, owner);

  await tokenDocRef.update({ tradingDisabled: soonDb().deleteField() });

  return await tokenDocRef.get<Token>();
};
