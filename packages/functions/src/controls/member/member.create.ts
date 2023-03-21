import { COL, Member } from '@soonaverse/interfaces';
import { soonDb } from '../../database/wrapper/soondb';
import { getRandomNonce } from '../../utils/wallet.utils';

export const createMemberControl = async (owner: string) => {
  const memberDocRef = soonDb().collection(COL.MEMBER).doc(owner);
  const member = await memberDocRef.get<Member>();

  if (!member) {
    await memberDocRef.create({ uid: owner, nonce: getRandomNonce() });
  }

  return await memberDocRef.get<Member>();
};
