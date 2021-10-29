import * as admin from 'firebase-admin';
import * as functions from "firebase-functions";
import { merge } from 'lodash';
import Web3 from 'web3';
import { Member } from '../interfaces/models/member';
import { CREATE_MEMBER_IF_NOT_EXISTS, WEN_FUNCTIONS } from './../interfaces/functions/index';
import { DOCUMENTS } from './../interfaces/models/base';
admin.initializeApp();

exports[WEN_FUNCTIONS.CREATE_MEMBER_IF_NOT_EXISTS] = functions.https.onCall(async (data: CREATE_MEMBER_IF_NOT_EXISTS): Promise<Member> => {
  // Validate address.
  if (!Web3.utils.isAddress(data?.address)) {
    throw new Error('Invalid address');
  }

  let docMember = await admin.firestore().collection(DOCUMENTS.MEMBER).doc(data.address).get();
  if (!docMember.exists) {
    // Document does not exists. We must create the member.
    await admin.firestore().collection(DOCUMENTS.MEMBER).doc(data.address).set({
      uid: data.address,
      createdOn: admin.firestore.Timestamp.now(),
      updatedOn: admin.firestore.Timestamp.now()
    });

    // Load latest
    docMember = await admin.firestore().collection(DOCUMENTS.MEMBER).doc(data.address).get();
  }

  // Return member.
  return <Member>docMember.data();
});

exports[WEN_FUNCTIONS.UPDATE_MEMBER_IF_NOT_EXISTS] = functions.https.onCall(async (data: Member): Promise<Member> => {
  // Validate address.
  if (!Web3.utils.isAddress(data?.uid)) {
    throw new Error('Invalid address');
  }

  let docMember = await admin.firestore().collection(DOCUMENTS.MEMBER).doc(data.uid).get();
  if (!docMember.exists) {
    throw new Error('Member does not exists');
  }

  await admin.firestore().collection(DOCUMENTS.MEMBER).doc(data.uid).update(merge(data, {
    updatedOn: admin.firestore.Timestamp.now()
  }));

  // Load latest
  docMember = await admin.firestore().collection(DOCUMENTS.MEMBER).doc(data.uid).get();

  // Return member.
  return <Member>docMember.data();
});
