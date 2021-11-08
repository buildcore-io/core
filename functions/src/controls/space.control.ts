import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from "joi";
import { merge } from 'lodash';
import { DecodedToken, StandardResponse } from '../../interfaces/functions/index';
import { DOCUMENTS } from '../../interfaces/models/base';
import { cOn, serverTime, uOn } from "../utils/dateTime.utils";
import { assertValidation, pSchema } from "../utils/schema.utils";
import { decodeToken, ethAddressLength, getRandomEthAddress } from "../utils/wallet.utils";
import { Space } from './../../interfaces/models/space';

function defaultJoiUpdateCreateSchema(): any {
  return {
    name: Joi.string().optional(),
    github: Joi.string().uri({
      scheme: ['https']
    }).optional(),
    twitter: Joi.string().uri({
      scheme: ['https']
    }).optional(),
    discord: Joi.string().uri({
      scheme: ['https']
    }).optional()
  };
};

export const createSpace: functions.CloudFunction<Space> = functions.https.onCall(async (token: string): Promise<Space> => {
  const params: DecodedToken = await decodeToken(token);
  const owner: string = params.address.toLowerCase();

  // We only get random address here that we use as ID.
  const address: string = getRandomEthAddress();

  // Body might be provided.
  if (params.body && Object.keys(params.body).length > 0) {
    const schema: ObjectSchema<Space> = Joi.object(defaultJoiUpdateCreateSchema());
    assertValidation(schema.validate(params.body));
  }

  const refSpace: any = admin.firestore().collection(DOCUMENTS.SPACE).doc(address);
  let docSpace = await refSpace.get();
  if (!docSpace.exists) {
    // Document does not exists. We must create the member.
    await refSpace.set(cOn(merge(params.body, {
      uid: address,
      createdBy: owner
    })));

    // Add Guardians.
    await refSpace.collection('guardians').doc(owner).set({
      uid: owner,
      createdOn: serverTime()
    });

    await refSpace.collection('members').doc(owner).set({
      uid: owner,
      createdOn: serverTime()
    });

    // Load latest
    docSpace = await refSpace.get();
  }

  // Return member.
  const membersOut: any = {};
  membersOut[owner] = (await refSpace.collection('members').doc(owner).get()).data();
  const guardiansOut: any = {};
  guardiansOut[owner] = (await refSpace.collection('guardians').doc(owner).get()).data();
  return merge(<Space>docSpace.data(), {
    guardians: guardiansOut,
    members: membersOut
  });
});

export const updateSpace: functions.CloudFunction<Space> = functions.https.onCall(async (token: string): Promise<Space> => {
  // We must part
  const params: DecodedToken = await decodeToken(token);
  const guardian = params.address.toLowerCase();

  const schema: ObjectSchema<Space> = Joi.object(merge(defaultJoiUpdateCreateSchema(), {
    uid: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(DOCUMENTS.SPACE).doc(params.body.uid);
  let docSpace = await refSpace.get();
  if (!docSpace.exists) {
    throw new Error('Space does not exists');
  }

  // Validate guardian is an guardian within the space.
  if (!(await refSpace.collection('guardians').doc(guardian).get()).exists) {
    throw new Error('You are not a guardian of the space.');
  }

  if (params.body) {
    await admin.firestore().collection(DOCUMENTS.SPACE).doc(params.body.uid).update(uOn(pSchema(schema, params.body)));

    // Load latest
    docSpace = await admin.firestore().collection(DOCUMENTS.SPACE).doc(params.body.uid).get();
  }

  // Return member.
  return <Space>docSpace.data();
});

export const joinSpace: functions.CloudFunction<Space> = functions.https.onCall(async (token: string): Promise<Space> => {
  // We must part
  const params: DecodedToken = await decodeToken(token);
  const owner = params.address.toLowerCase();

  const schema: ObjectSchema<Space> = Joi.object(({
      uid: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(DOCUMENTS.SPACE).doc(params.body.uid);
  let docSpace: any;
  if (!(await refSpace.get()).exists) {
    throw new Error('Space does not exists');
  }

  // Validate guardian is an guardian within the space.
  if ((await refSpace.collection('members').doc(owner).get()).exists) {
    throw new Error('You are already part of the space.');
  }

  if ((await refSpace.collection('blockedMembers').doc(owner).get()).exists) {
    throw new Error('You are are not allowed to join space.');
  }

  if (params.body) {
    await refSpace.collection('members').doc(owner).set({
      uid: owner,
      createdOn: serverTime()
    });

    // Load latest
    docSpace = await refSpace.collection('members').doc(owner).get();
  }

  // Return member.
  return <Space>docSpace.data();
});

export const leaveSpace: functions.CloudFunction<Space> = functions.https.onCall(async (token: string): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeToken(token);
  const owner = params.address.toLowerCase();

  const schema: ObjectSchema<Space> = Joi.object(({
      uid: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(DOCUMENTS.SPACE).doc(params.body.uid);
  if (!(await refSpace.get()).exists) {
    throw new Error('Space does not exists');
  }

  // Validate guardian is an guardian within the space.
  if (!(await refSpace.collection('members').doc(owner).get()).exists) {
    throw new Error('You are not part of the space.');
  }

  const isGuardian: boolean = (await refSpace.collection('guardians').doc(owner).get()).exists;
  // Must be minimum one member.
  const members: any[] = await refSpace.collection('members').listDocuments();
  if (members.length === 1) {
    throw new Error('At least one member must be in the space.');
  }

  // Is last guardian? isGuardian
  const guardians: any[] = await refSpace.collection('guardians').listDocuments();
  if (guardians.length === 1 && isGuardian) {
    throw new Error('At least one guardian must be in the space.');
  }

  if (params.body) {
    await refSpace.collection('members').doc(owner).delete();

    // If this member is always guardian he must be removed.
    if (isGuardian) {
      await refSpace.collection('guardians').doc(owner).delete();
    }
  }

  return {
    status: 'success'
  };
});

export const addGuardian: functions.CloudFunction<Space> = functions.https.onCall(async (token: string): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeToken(token);
  const guardian = params.address.toLowerCase();

  const schema: ObjectSchema<Space> = Joi.object(({
      uid: Joi.string().length(ethAddressLength).lowercase().required(),
      member: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(DOCUMENTS.SPACE).doc(params.body.uid);
  let docSpace: any;
  if (!(await refSpace.get()).exists) {
    throw new Error('Space does not exists');
  }

  // Validate guardian is an guardian within the space.
  if (!(await refSpace.collection('guardians').doc(guardian).get()).exists) {
    throw new Error('You are not a guardian of the space.');
  }

  if (!(await refSpace.collection('members').doc(params.body.member).get()).exists) {
    throw new Error('Member is not part of the space.');
  }

  if ((await refSpace.collection('guardians').doc(params.body.member).get()).exists) {
    throw new Error('Member is already guardian of space.');
  }

  if (params.body) {
    await refSpace.collection('guardians').doc(params.body.member).set({
      uid: params.body.member,
      createdOn: serverTime()
    });

    // Load latest
    docSpace = await refSpace.collection('guardians').doc(params.body.member).get();
  }

  return docSpace.data();
});

export const removeGuardian: functions.CloudFunction<Space> = functions.https.onCall(async (token: string): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeToken(token);
  const guardian = params.address.toLowerCase();

  const schema: ObjectSchema<Space> = Joi.object(({
      uid: Joi.string().length(ethAddressLength).lowercase().required(),
      member: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(DOCUMENTS.SPACE).doc(params.body.uid);
  if (!(await refSpace.get()).exists) {
    throw new Error('Space does not exists');
  }

  // Validate guardian is an guardian within the space.
  if (!(await refSpace.collection('guardians').doc(guardian).get()).exists) {
    throw new Error('You are not a guardian of the space.');
  }

  if (!(await refSpace.collection('members').doc(params.body.member).get()).exists) {
    throw new Error('Member is not part of the space.');
  }

  if (!(await refSpace.collection('guardians').doc(params.body.member).get()).exists) {
    throw new Error('Member is NOT guardian of space.');
  }

  if (params.body) {
    await refSpace.collection('guardians').doc(params.body.member).delete();
  }

  return {
    status: 'success'
  };
});

export const blockMember: functions.CloudFunction<Space> = functions.https.onCall(async (token: string): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeToken(token);
  const guardian = params.address.toLowerCase();

  const schema: ObjectSchema<Space> = Joi.object(({
      uid: Joi.string().length(ethAddressLength).lowercase().required(),
      member: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(DOCUMENTS.SPACE).doc(params.body.uid);
  let docSpace: any;
  if (!(await refSpace.get()).exists) {
    throw new Error('Space does not exists');
  }

  const isGuardian: boolean = (await refSpace.collection('guardians').doc(params.body.member).get()).exists;
  // Validate guardian is an guardian within the space.
  if (!(await refSpace.collection('guardians').doc(guardian).get()).exists) {
    throw new Error('You are not a guardian of the space.');
  }

  if (!(await refSpace.collection('members').doc(params.body.member).get()).exists) {
    throw new Error('Member is not part of the space.');
  }

  if ((await refSpace.collection('blockedMembers').doc(params.body.member).get()).exists) {
    throw new Error('Member is already blocked.');
  }

  if (params.body) {
    await refSpace.collection('blockedMembers').doc(params.body.member).set({
      uid: params.body.member,
      createdOn: serverTime()
    });

    await refSpace.collection('members').doc(params.body.member).delete();

    // If this member is always guardian he must be removed.
    if (isGuardian) {
      await refSpace.collection('guardians').doc(params.body.member).delete();
    }

    // Load latest
    docSpace = await refSpace.collection('blockedMembers').doc(params.body.member).get();
  }

  return docSpace.data();
});

export const unblockMember: functions.CloudFunction<Space> = functions.https.onCall(async (token: string): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeToken(token);
  const guardian = params.address.toLowerCase();

  const schema: ObjectSchema<Space> = Joi.object(({
      uid: Joi.string().length(ethAddressLength).lowercase().required(),
      member: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(DOCUMENTS.SPACE).doc(params.body.uid);
  if (!(await refSpace.get()).exists) {
    throw new Error('Space does not exists');
  }

  // Validate guardian is an guardian within the space.
  if (!(await refSpace.collection('guardians').doc(guardian).get()).exists) {
    throw new Error('You are not a guardian of the space.');
  }

  if (!(await refSpace.collection('blockedMembers').doc(params.body.member).get()).exists) {
    throw new Error('Member is NOT blocked in the space.');
  }

  if (params.body) {
    await refSpace.collection('blockedMembers').doc(params.body.member).delete();
  }

  return {
    status: 'success'
  };
});

