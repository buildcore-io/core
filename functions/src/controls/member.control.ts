import * as admin from 'firebase-admin';
import * as functions from "firebase-functions";
import { CloudFunction } from "firebase-functions";
import { DecodedToken } from '../../interfaces/functions/index';
import { DOCUMENTS } from '../../interfaces/models/base';
import { Member } from '../../interfaces/models/member';
import { cOn, uOn } from "../utils/dateTime.utils";
import { cleanParams, decodeToken } from "../utils/wallet.utils";

export const createMember: CloudFunction<Member> = functions.https.onCall(async (token: string): Promise<Member> => {
  const params: DecodedToken = await decodeToken(token);
  let docMember = await admin.firestore().collection(DOCUMENTS.MEMBER).doc(params.address).get();
  if (!docMember.exists) {
    // Document does not exists. We must create the member.
    await admin.firestore().collection(DOCUMENTS.MEMBER).doc(params.address).set(cOn({
      uid: params.address
    }));

    // Load latest
    docMember = await admin.firestore().collection(DOCUMENTS.MEMBER).doc(params.address).get();
  }

  // Return member.
  return <Member>docMember.data();
});

export const updateMember: CloudFunction<Member> = functions.https.onCall(async (token: string): Promise<Member> => {
  // We must part
  const params: DecodedToken = await decodeToken(token);
  let docMember = await admin.firestore().collection(DOCUMENTS.MEMBER).doc(params.address).get();
  if (!docMember.exists) {
    throw new Error('Member does not exists');
  }

  if (params.body) {
    await admin.firestore().collection(DOCUMENTS.MEMBER).doc(params.address).update(uOn(cleanParams(params.body)));

    // Load latest
    docMember = await admin.firestore().collection(DOCUMENTS.MEMBER).doc(params.address).get();
  }

  // Return member.
  return <Member>docMember.data();
});
