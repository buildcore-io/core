import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { DecodedToken } from '../../interfaces/functions/index';
import { DOCUMENTS } from '../../interfaces/models/base';
import { Member } from '../../interfaces/models/member';
import { cOn, uOn } from "../utils/dateTime.utils";
import { cleanParams, decodeToken } from "../utils/wallet.utils";

export const createMember: functions.CloudFunction<Member> = functions.https.onCall(async (token: string): Promise<Member> => {
  const params: DecodedToken = await decodeToken(token);
  const address = params.address.toLowerCase();
  let docMember = await admin.firestore().collection(DOCUMENTS.MEMBER).doc(address).get();
  if (!docMember.exists) {
    // Document does not exists. We must create the member.
    await admin.firestore().collection(DOCUMENTS.MEMBER).doc(address).set(cOn({
      uid: address
    }));

    // Load latest
    docMember = await admin.firestore().collection(DOCUMENTS.MEMBER).doc(address).get();
  }

  // Return member.
  return <Member>docMember.data();
});

export const updateMember: functions.CloudFunction<Member> = functions.https.onCall(async (token: string): Promise<Member> => {
  // We must part
  const params: DecodedToken = await decodeToken(token);
  const address = params.address.toLowerCase();
  let docMember = await admin.firestore().collection(DOCUMENTS.MEMBER).doc(address).get();
  if (!docMember.exists) {
    throw new Error('Member does not exists');
  }

  if (params.body) {
    await admin.firestore().collection(DOCUMENTS.MEMBER).doc(address).update(uOn(cleanParams(params.body)));

    // Load latest
    docMember = await admin.firestore().collection(DOCUMENTS.MEMBER).doc(address).get();
  }

  // Return member.
  return <Member>docMember.data();
});
