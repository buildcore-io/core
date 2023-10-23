import { build5Db } from '@build-5/database';
import { COL, Member } from '@build-5/interfaces';
import { getRandomNonce } from '../../utils/wallet.utils';
import { Context } from '../common';

export const createMemberControl = async ({ owner }: Context) => {
  const memberDocRef = build5Db().collection(COL.MEMBER).doc(owner);
  const member = await memberDocRef.get<Member>();

  if (!member) {
    await memberDocRef.create({ uid: owner, nonce: getRandomNonce() });
  }

  return (await memberDocRef.get<Member>())!;
};
