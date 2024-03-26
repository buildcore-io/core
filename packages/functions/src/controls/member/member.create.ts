import { build5Db } from '@build-5/database';
import { COL } from '@build-5/interfaces';
import { getRandomNonce } from '../../utils/wallet.utils';
import { Context } from '../common';

export const createMemberControl = async ({ owner }: Context) => {
  const memberDocRef = build5Db().doc(COL.MEMBER, owner);
  await memberDocRef.upsert({ nonce: getRandomNonce() });
  return (await memberDocRef.get())!;
};
