import { build5Db } from '@build-5/database';
import { COL, EnableTokenTradingRequest, Token, WenError } from '@build-5/interfaces';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';

export const enableTokenTradingControl = async (
  owner: string,
  params: EnableTokenTradingRequest,
) => {
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${params.uid}`);
  const token = await tokenDocRef.get<Token>();
  if (!token) {
    throw invalidArgument(WenError.token_does_not_exist);
  }

  if (!token.public) {
    throw invalidArgument(WenError.token_must_be_public);
  }

  await assertIsGuardian(token.space, owner);

  await tokenDocRef.update({ tradingDisabled: build5Db().deleteField() });

  return (await tokenDocRef.get<Token>())!;
};
