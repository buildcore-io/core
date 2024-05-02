import { database } from '@buildcore/database';
import { COL } from '@buildcore/interfaces';
import { getRandomNonce } from '../../utils/wallet.utils';
import { Context } from '../common';

export const createMemberControl = async ({ owner }: Context) => {
  const memberDocRef = database().doc(COL.MEMBER, owner);
  await memberDocRef.upsert({ nonce: getRandomNonce() });
  return (await memberDocRef.get())!;
};
