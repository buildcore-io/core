import { COL, Member } from '@build-5/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { getRandomNonce } from '../../utils/wallet.utils';

export const createMemberControl = async (owner: string) => {
  const memberDocRef = soonDb().collection(COL.MEMBER).doc(owner);
  const member = await memberDocRef.get<Member>();

  if (!member) {
    await memberDocRef.create({ uid: owner, nonce: getRandomNonce() });
  }

  return await memberDocRef.get<Member>();
};
