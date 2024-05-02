import { build5Db } from '@build-5/database';
import { COL, EnableTokenTradingRequest, WenError } from '@build-5/interfaces';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsTokenGuardian } from '../../utils/token.utils';
import { Context } from '../common';

export const enableTokenTradingControl = async ({
  owner,
  params,
}: Context<EnableTokenTradingRequest>) => {
  const tokenDocRef = build5Db().doc(COL.TOKEN, params.uid);
  const token = await tokenDocRef.get();
  if (!token) {
    throw invalidArgument(WenError.token_does_not_exist);
  }

  if (!token.public) {
    throw invalidArgument(WenError.token_must_be_public);
  }

  await assertIsTokenGuardian(token, owner);

  await tokenDocRef.update({ tradingDisabled: false });

  return (await tokenDocRef.get())!;
};
