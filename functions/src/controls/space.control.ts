import { QuerySnapshot } from '@firebase/firestore';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from "joi";
import { merge } from 'lodash';
import { DecodedToken, StandardResponse } from '../../interfaces/functions/index';
import { COL, SUB_COL, WenRequest } from '../../interfaces/models/base';
import { cOn, serverTime, uOn } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { assertValidation, getDefaultParams, pSchema } from "../utils/schema.utils";
import { cleanParams, decodeAuth, ethAddressLength, getRandomEthAddress } from "../utils/wallet.utils";
import { WenError } from './../../interfaces/errors';
import { Space } from './../../interfaces/models/space';

function defaultJoiUpdateCreateSchema(): any {
  return merge(getDefaultParams(), {
    name: Joi.string().allow(null, '').optional(),
    about: Joi.string().allow(null, '').optional(),
    open: Joi.boolean().allow(false, true).optional(),
    github: Joi.string().allow(null, '').uri({
      scheme: ['https']
    }).optional(),
    twitter: Joi.string().allow(null, '').uri({
      scheme: ['https']
    }).optional(),
    discord: Joi.string().allow(null, '').uri({
      scheme: ['https']
    }).optional(),
    avatarUrl: Joi.string().allow(null, '').uri({
      scheme: ['https']
    }).optional(),
    bannerUrl: Joi.string().allow(null, '').uri({
      scheme: ['https']
    }).optional()
  });
};

export const createSpace: functions.CloudFunction<Space> = functions.https.onCall(async (req: WenRequest): Promise<Space> => {
  const params: DecodedToken = await decodeAuth(req);
  const owner: string = params.address.toLowerCase();

  // We only get random address here that we use as ID.
  const spaceAddress: string = getRandomEthAddress();

  // Body might be provided.
  if (params.body && Object.keys(params.body).length > 0) {
    const schema: ObjectSchema<Space> = Joi.object(defaultJoiUpdateCreateSchema());
    assertValidation(schema.validate(params.body));
  }

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(spaceAddress);
  let docSpace = await refSpace.get();
  if (!docSpace.exists) {
    // Document does not exists. We must create the member.
    await refSpace.set(cOn(merge(cleanParams(params.body), {
      uid: spaceAddress,
      createdBy: owner,
      // Default is open.
      open: (params.body.open === false || params.body.open === true) ? params.body.open : true,
      totalMembers: 1,
      totalGuardians: 1
    })));

    // Add Guardians.
    await refSpace.collection(SUB_COL.GUARDIANS).doc(owner).set({
      uid: owner,
      parentId: spaceAddress,
      parentCol: COL.SPACE,
      createdOn: serverTime()
    });

    await refSpace.collection(SUB_COL.MEMBERS).doc(owner).set({
      uid: owner,
      parentId: spaceAddress,
      parentCol: COL.SPACE,
      createdOn: serverTime()
    });

    // Load latest
    docSpace = await refSpace.get();
  }

  // Return member.
  const membersOut: any = {};
  membersOut[owner] = (await refSpace.collection(SUB_COL.MEMBERS).doc(owner).get()).data();
  const guardiansOut: any = {};
  guardiansOut[owner] = (await refSpace.collection(SUB_COL.GUARDIANS).doc(owner).get()).data();
  return merge(<Space>docSpace.data(), {
    guardians: guardiansOut,
    members: membersOut
  });
});

export const updateSpace: functions.CloudFunction<Space> = functions.https.onCall(async (req: WenRequest): Promise<Space> => {
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const guardian = params.address.toLowerCase();

  const schema: ObjectSchema<Space> = Joi.object(merge(defaultJoiUpdateCreateSchema(), {
    uid: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(params.body.uid);
  let docSpace = await refSpace.get();
  if (!docSpace.exists) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }

  // Validate guardian is an guardian within the space.
  if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(guardian).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
  }

  // Decline all pending members.
  if (params.body.open === false) {
    const query: QuerySnapshot = await refSpace.collection(SUB_COL.KNOCKING_MEMBERS).get();
    query.forEach(async (g) => {
      await refSpace.collection(SUB_COL.KNOCKING_MEMBERS).doc(g.data().uid).delete();
    });
  }

  if (params.body) {
    await admin.firestore().collection(COL.SPACE).doc(params.body.uid).update(uOn(pSchema(schema, params.body)));

    // Load latest
    docSpace = await admin.firestore().collection(COL.SPACE).doc(params.body.uid).get();
  }

  // Return member.
  return <Space>docSpace.data();
});

export const joinSpace: functions.CloudFunction<Space> = functions.https.onCall(async (req: WenRequest): Promise<Space> => {
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const owner = params.address.toLowerCase();

  const schema: ObjectSchema<Space> = Joi.object(merge(getDefaultParams(), {
      uid: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(params.body.uid);
  const docSpace: any = await refSpace.get();
  const isOpenSpace = !!docSpace.data().open;
  let output: any;
  if (!docSpace.exists) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }

  // Validate guardian is an guardian within the space.
  if ((await refSpace.collection(SUB_COL.MEMBERS).doc(owner).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_already_part_of_space);
  }

  if ((await refSpace.collection(SUB_COL.BLOCKED_MEMBERS).doc(owner).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_allowed_to_join_space);
  }
  if (params.body) {
    await refSpace.collection(isOpenSpace ? SUB_COL.MEMBERS : SUB_COL.KNOCKING_MEMBERS).doc(owner).set({
      uid: owner,
      parentId: params.body.uid,
      parentCol: COL.SPACE,
      createdOn: serverTime()
    });

    // Set members.
    await admin.firestore().runTransaction(async (transaction) => {
      const sfDoc: any = await transaction.get(refSpace);
      let totalMembers = (sfDoc.data().totalMembers || 0);
      let totalPendingMembers = (sfDoc.data().totalPendingMembers || 0);
      if (isOpenSpace) {
        totalMembers++;
      } else {
        totalPendingMembers++;
      }
      transaction.update(refSpace, {
        totalMembers: totalMembers,
        totalPendingMembers: totalPendingMembers
      });
    });

    // Load latest
    output = await refSpace.collection(isOpenSpace ? SUB_COL.MEMBERS : SUB_COL.KNOCKING_MEMBERS).doc(owner).get();
  }

  // Return member.
  return <Space>output.data();
});

export const leaveSpace: functions.CloudFunction<Space> = functions.https.onCall(async (req: WenRequest): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const owner = params.address.toLowerCase();

  const schema: ObjectSchema<Space> = Joi.object(merge(getDefaultParams(), {
      uid: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(params.body.uid);
  if (!(await refSpace.get()).exists) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }

  // Validate guardian is an guardian within the space.
  if (!(await refSpace.collection(SUB_COL.MEMBERS).doc(owner).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_part_of_the_space);
  }

  const isGuardian: boolean = (await refSpace.collection(SUB_COL.GUARDIANS).doc(owner).get()).exists;
  // Must be minimum one member.
  const members: any[] = await refSpace.collection(SUB_COL.MEMBERS).listDocuments();
  if (members.length === 1) {
    throw throwInvalidArgument(WenError.at_least_one_member_must_be_in_the_space);
  }

  // Is last guardian? isGuardian
  const guardians: any[] = await refSpace.collection(SUB_COL.GUARDIANS).listDocuments();
  if (guardians.length === 1 && isGuardian) {
    throw throwInvalidArgument(WenError.at_least_one_guardian_must_be_in_the_space);
  }

  if (params.body) {
    await refSpace.collection(SUB_COL.MEMBERS).doc(owner).delete();

    await admin.firestore().runTransaction(async (transaction) => {
      const sfDoc: any = await transaction.get(refSpace);
      const totalMembers = (sfDoc.data().totalMembers || 0) - 1;
      transaction.update(refSpace, {
        totalMembers: totalMembers
      });
    });

    // If this member is always guardian he must be removed.
    if (isGuardian) {
      await refSpace.collection(SUB_COL.GUARDIANS).doc(owner).delete();
    }
  }

  return {
    status: 'success'
  };
});

export const addGuardian: functions.CloudFunction<Space> = functions.https.onCall(async (req: WenRequest): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const guardian = params.address.toLowerCase();

  const schema: ObjectSchema<Space> = Joi.object(merge(getDefaultParams(), {
      uid: Joi.string().length(ethAddressLength).lowercase().required(),
      member: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(params.body.uid);
  let docSpace: any;
  if (!(await refSpace.get()).exists) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }

  // Validate guardian is an guardian within the space.
  if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(guardian).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
  }

  if (!(await refSpace.collection(SUB_COL.MEMBERS).doc(params.body.member).get()).exists) {
    throw throwInvalidArgument(WenError.member_is_not_part_of_the_space);
  }

  if ((await refSpace.collection(SUB_COL.GUARDIANS).doc(params.body.member).get()).exists) {
    throw throwInvalidArgument(WenError.member_is_already_guardian_of_space);
  }

  if (params.body) {
    await refSpace.collection(SUB_COL.GUARDIANS).doc(params.body.member).set({
      uid: params.body.member,
      parentId: params.body.uid,
      parentCol: COL.SPACE,
      createdOn: serverTime()
    });

    await admin.firestore().runTransaction(async (transaction) => {
      const sfDoc: any = await transaction.get(refSpace);
      const totalGuardians = (sfDoc.data().totalGuardians || 0) + 1;
      transaction.update(refSpace, {
        totalGuardians: totalGuardians
      });
    });

    // Load latest
    docSpace = await refSpace.collection(SUB_COL.GUARDIANS).doc(params.body.member).get();
  }

  return docSpace.data();
});

export const removeGuardian: functions.CloudFunction<Space> = functions.https.onCall(async (req: WenRequest): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const guardian = params.address.toLowerCase();

  const schema: ObjectSchema<Space> = Joi.object(merge(getDefaultParams(), {
      uid: Joi.string().length(ethAddressLength).lowercase().required(),
      member: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(params.body.uid);
  if (!(await refSpace.get()).exists) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }

  // Validate guardian is an guardian within the space.
  if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(guardian).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
  }

  if (!(await refSpace.collection(SUB_COL.MEMBERS).doc(params.body.member).get()).exists) {
    throw throwInvalidArgument(WenError.member_is_not_part_of_the_space);
  }

  if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(params.body.member).get()).exists) {
    throw throwInvalidArgument(WenError.member_is_not_guardian_of_space);
  }

  const guardians: any[] = await refSpace.collection(SUB_COL.GUARDIANS).listDocuments();
  if (guardians.length === 1) {
    throw throwInvalidArgument(WenError.at_least_one_guardian_must_be_in_the_space);
  }

  if (params.body) {
    await refSpace.collection(SUB_COL.GUARDIANS).doc(params.body.member).delete();
    await admin.firestore().runTransaction(async (transaction) => {
      const sfDoc: any = await transaction.get(refSpace);
      const totalGuardians = (sfDoc.data().totalGuardians || 0) - 1;
      transaction.update(refSpace, {
        totalGuardians: totalGuardians
      });
    });
  }

  return {
    status: 'success'
  };
});

export const blockMember: functions.CloudFunction<Space> = functions.https.onCall(async (req: WenRequest): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const guardian = params.address.toLowerCase();

  const schema: ObjectSchema<Space> = Joi.object(merge(getDefaultParams(), {
      uid: Joi.string().length(ethAddressLength).lowercase().required(),
      member: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(params.body.uid);
  let docSpace: any;
  if (!(await refSpace.get()).exists) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }

  const isGuardian: boolean = (await refSpace.collection(SUB_COL.GUARDIANS).doc(params.body.member).get()).exists;
  // Validate guardian is an guardian within the space.
  if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(guardian).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
  }

  if (!(await refSpace.collection(SUB_COL.MEMBERS).doc(params.body.member).get()).exists) {
    throw throwInvalidArgument(WenError.member_is_not_part_of_the_space);
  }

  if ((await refSpace.collection(SUB_COL.BLOCKED_MEMBERS).doc(params.body.member).get()).exists) {
    throw throwInvalidArgument(WenError.member_is_already_blocked);
  }

  if (params.body) {
    await refSpace.collection(SUB_COL.BLOCKED_MEMBERS).doc(params.body.member).set({
      uid: params.body.member,
      parentId: params.body.uid,
      parentCol: COL.SPACE,
      createdOn: serverTime()
    });

    await refSpace.collection(SUB_COL.MEMBERS).doc(params.body.member).delete();

    // If this member is always guardian he must be removed.
    if (isGuardian) {
      await refSpace.collection(SUB_COL.GUARDIANS).doc(params.body.member).delete();
    }

    await admin.firestore().runTransaction(async (transaction) => {
      const sfDoc: any = await transaction.get(refSpace);
      const totalMembers = (sfDoc.data().totalMembers || 0) - 1;
      const totalGuardians = (sfDoc.data().totalGuardians || 0) - (isGuardian ? 1 : 0);
      transaction.update(refSpace, {
        totalGuardians: totalGuardians,
        totalMembers: totalMembers
      });
    });

    // Load latest
    docSpace = await refSpace.collection(SUB_COL.BLOCKED_MEMBERS).doc(params.body.member).get();
  }

  return docSpace.data();
});

export const unblockMember: functions.CloudFunction<Space> = functions.https.onCall(async (req: WenRequest): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const guardian = params.address.toLowerCase();

  const schema: ObjectSchema<Space> = Joi.object(merge(getDefaultParams(), {
      uid: Joi.string().length(ethAddressLength).lowercase().required(),
      member: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(params.body.uid);
  if (!(await refSpace.get()).exists) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }

  // Validate guardian is an guardian within the space.
  if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(guardian).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
  }

  if (!(await refSpace.collection(SUB_COL.BLOCKED_MEMBERS).doc(params.body.member).get()).exists) {
    throw throwInvalidArgument(WenError.member_is_not_blocked_in_the_space);
  }

  if (params.body) {
    await refSpace.collection(SUB_COL.BLOCKED_MEMBERS).doc(params.body.member).delete();
  }

  return {
    status: 'success'
  };
});

export const acceptMemberSpace: functions.CloudFunction<Space> = functions.https.onCall(async (req: WenRequest): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const guardian = params.address.toLowerCase();

  const schema: ObjectSchema<Space> = Joi.object(merge(getDefaultParams(), {
      uid: Joi.string().length(ethAddressLength).lowercase().required(),
      member: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(params.body.uid);
  let docSpace: any;
  if (!(await refSpace.get()).exists) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }

  // Validate guardian is an guardian within the space.
  if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(guardian).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
  }

  if (!(await refSpace.collection(SUB_COL.KNOCKING_MEMBERS).doc(params.body.member).get()).exists) {
    throw throwInvalidArgument(WenError.member_did_not_request_to_join);
  }

  if (params.body) {
    await refSpace.collection(SUB_COL.MEMBERS).doc(params.body.member).set({
      uid: params.body.member,
      parentId: params.body.uid,
      parentCol: COL.SPACE,
      createdOn: serverTime()
    });

    await refSpace.collection(SUB_COL.KNOCKING_MEMBERS).doc(params.body.member).delete();

    await admin.firestore().runTransaction(async (transaction) => {
      const sfDoc: any = await transaction.get(refSpace);
      const totalMembers = (sfDoc.data().totalMembers || 0) + 1;
      transaction.update(refSpace, {
        totalMembers: totalMembers
      });
    });

    // Load latest
    docSpace = await refSpace.collection(SUB_COL.MEMBERS).doc(params.body.member).get();
  }

  return docSpace.data();
});

export const declineMemberSpace: functions.CloudFunction<Space> = functions.https.onCall(async (req: WenRequest): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const guardian = params.address.toLowerCase();

  const schema: ObjectSchema<Space> = Joi.object(merge(getDefaultParams(), {
      uid: Joi.string().length(ethAddressLength).lowercase().required(),
      member: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(params.body.uid);
  if (!(await refSpace.get()).exists) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }

  // Validate guardian is an guardian within the space.
  if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(guardian).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
  }

  if (!(await refSpace.collection(SUB_COL.KNOCKING_MEMBERS).doc(params.body.member).get()).exists) {
    throw throwInvalidArgument(WenError.member_did_not_request_to_join);
  }

  if (params.body) {
    await refSpace.collection(SUB_COL.KNOCKING_MEMBERS).doc(params.body.member).delete();
  }

  return {
    status: 'success'
  };
});
