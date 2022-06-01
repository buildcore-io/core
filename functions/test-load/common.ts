import * as admin from 'firebase-admin';
import { URL_PATHS } from '../interfaces/config';
import { Member } from '../interfaces/models';
import { COL } from '../interfaces/models/base';
import { cOn } from '../src/utils/dateTime.utils';

export const createMemberCopies = async (guardian: Member, membersCount: number) => {
  const createMemberCopy = async () => {
    let uid = admin.firestore().collection(COL.MEMBER).doc().id;
    const generatedNonce = Math.floor(Math.random() * 1000000).toString();
    await admin.firestore().collection(COL.MEMBER).doc(uid).set(cOn({
      uid,
      nonce: generatedNonce,
      validatedAddress: guardian.validatedAddress
    }, URL_PATHS.MEMBER));
    return uid
  }

  const promises = Array.from(Array(membersCount)).map(() => createMemberCopy())
  return await Promise.all(promises)
}
