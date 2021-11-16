import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from "joi";
import { merge } from 'lodash';
import { WenError } from '../../interfaces/errors';
import { DecodedToken } from '../../interfaces/functions/index';
import { COL, WenRequest } from '../../interfaces/models/base';
import { cOn, uOn } from "../utils/dateTime.utils";
import { throwInvalidArgument, throwUnAuthenticated } from "../utils/error.utils";
import { assertValidation, getDefaultParams, pSchema } from "../utils/schema.utils";
import { cleanParams, decodeAuth, ethAddressLength } from "../utils/wallet.utils";
import { Member } from '../../interfaces/models/member';

export const createMember: functions.CloudFunction<Member> = functions.runWith({
  // Keep 1 instance so we never have cold start.
  minInstances: 1,
}).https.onCall(async (address: string): Promise<Member> => {
  if (!address || address.length !== ethAddressLength) {
    throw throwUnAuthenticated(WenError.address_must_be_provided);
  }

  let docMember = await admin.firestore().collection(COL.MEMBER).doc(address).get();
  const generatedNonce: string = Math.floor(Math.random() * 1000000).toString();
  if (!docMember.exists) {
    // Document does not exists. We must create the member.
    await admin.firestore().collection(COL.MEMBER).doc(address).set(cOn({
      uid: address,
      nonce: generatedNonce
    }));

    // Load latest
    docMember = await admin.firestore().collection(COL.MEMBER).doc(address).get();
  }

  // Return member.
  return <Member>docMember.data();
});
