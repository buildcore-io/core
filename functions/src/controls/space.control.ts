import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from 'joi';
import { merge } from 'lodash';
import { DecodedToken, StandardResponse, WEN_FUNC } from '../../interfaces/functions/index';
import { COL, SUB_COL, WenRequest } from '../../interfaces/models/base';
import { DocumentSnapshotType } from '../../interfaces/models/firebase';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { cOn, serverTime, uOn } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertValidation, getDefaultParams, pSchema } from '../utils/schema.utils';
import { cleanParams, decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';
import { GITHUB_REGEXP, TWITTER_REGEXP, URL_PATHS } from './../../interfaces/config';
import { WenError } from './../../interfaces/errors';
import { Space, SpaceMember } from './../../interfaces/models/space';
import { CommonJoi } from './../services/joi/common';
import { SpaceValidator } from './../services/validators/space';

function defaultJoiUpdateCreateSchema(): Space {
  return merge(getDefaultParams<Space>(), {
    name: Joi.string().allow(null, '').optional(),
    about: Joi.string().allow(null, '').optional(),
    open: Joi.boolean().allow(false, true).optional(),
    discord: Joi.string().allow(null, '').alphanum().optional(),
    github: Joi.string().allow(null, '').regex(GITHUB_REGEXP).optional(),
    twitter: Joi.string().allow(null, '').regex(TWITTER_REGEXP).optional(),
    avatarUrl: Joi.string()
      .allow(null, '')
      .uri({
        scheme: ['https'],
      })
      .optional(),
    bannerUrl: Joi.string()
      .allow(null, '')
      .uri({
        scheme: ['https'],
      })
      .optional(),
  });
}

export const createSpace: functions.CloudFunction<Space> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.cSpace),
  })
  .https.onCall(
    async (req: WenRequest, context: functions.https.CallableContext): Promise<Space> => {
      appCheck(WEN_FUNC.cSpace, context);
      const params: DecodedToken = await decodeAuth(req);
      const owner: string = params.address.toLowerCase();

      // We only get random address here that we use as ID.
      const spaceAddress: string = getRandomEthAddress();

      // Body might be provided.
      if (params.body && Object.keys(params.body).length > 0) {
        const schema: ObjectSchema<Space> = Joi.object(defaultJoiUpdateCreateSchema());
        assertValidation(schema.validate(params.body));
      }

      const refSpace: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.SPACE)
        .doc(spaceAddress);
      let docSpace = await refSpace.get();
      if (!docSpace.exists) {
        // Document does not exists. We must create the member.
        await refSpace.set(
          cOn(
            merge(cleanParams(params.body), {
              uid: spaceAddress,
              createdBy: owner,
              // Default is open.
              open: params.body.open === false ? false : true,
              totalMembers: 1,
              totalGuardians: 1,
              totalPendingMembers: 0,
              rank: 1,
            }),
            URL_PATHS.SPACE,
          ),
        );

        // Add Guardians.
        await refSpace.collection(SUB_COL.GUARDIANS).doc(owner).set({
          uid: owner,
          parentId: spaceAddress,
          parentCol: COL.SPACE,
          createdOn: serverTime(),
        });

        await refSpace.collection(SUB_COL.MEMBERS).doc(owner).set({
          uid: owner,
          parentId: spaceAddress,
          parentCol: COL.SPACE,
          createdOn: serverTime(),
        });

        // Load latest
        docSpace = await refSpace.get();
      }

      // Return member.
      const membersOut = {} as { [key: string]: admin.firestore.DocumentData | undefined };
      membersOut[owner] = (await refSpace.collection(SUB_COL.MEMBERS).doc(owner).get()).data();
      const guardiansOut = {} as { [key: string]: admin.firestore.DocumentData | undefined };
      guardiansOut[owner] = (await refSpace.collection(SUB_COL.GUARDIANS).doc(owner).get()).data();
      return merge(<Space>docSpace.data(), {
        guardians: guardiansOut,
        members: membersOut,
      });
    },
  );

export const updateSpace: functions.CloudFunction<Space> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.uSpace),
  })
  .https.onCall(
    async (req: WenRequest, context: functions.https.CallableContext): Promise<Space> => {
      appCheck(WEN_FUNC.uSpace, context);
      // Validate auth details before we continue
      const params: DecodedToken = await decodeAuth(req);
      const guardian = params.address.toLowerCase();

      const schema: ObjectSchema<Space> = Joi.object(
        merge(defaultJoiUpdateCreateSchema(), {
          uid: CommonJoi.uidCheck(),
        }),
      );
      assertValidation(schema.validate(params.body));

      const refSpace: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.SPACE)
        .doc(params.body.uid);
      let docSpace = await refSpace.get();
      if (!docSpace.exists) {
        throw throwInvalidArgument(WenError.space_does_not_exists);
      }

      // Validate guardian is an guardian within the space.
      await SpaceValidator.isGuardian(refSpace, guardian);

      // Decline all pending members.
      let append = {};
      if (params.body.open === true) {
        const query: admin.firestore.QuerySnapshot = await refSpace
          .collection(SUB_COL.KNOCKING_MEMBERS)
          .get();
        for (const g of query.docs) {
          await refSpace.collection(SUB_COL.KNOCKING_MEMBERS).doc(g.data().uid).delete();
        }

        append = {
          totalPendingMembers: 0,
        };
      }

      if (params.body) {
        await admin
          .firestore()
          .collection(COL.SPACE)
          .doc(params.body.uid)
          .update(merge(uOn(pSchema(schema, params.body)), append));

        // Load latest
        docSpace = await admin.firestore().collection(COL.SPACE).doc(params.body.uid).get();
      }

      // Return member.
      return <Space>docSpace.data();
    },
  );

export const joinSpace = functions
  .runWith({
    minInstances: scale(WEN_FUNC.joinSpace),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.joinSpace, context);
    const params = await decodeAuth(req);
    const owner = params.address.toLowerCase();

    const schema = Joi.object({
      uid: CommonJoi.uidCheck(),
    });
    assertValidation(schema.validate(params.body));

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${params.body.uid}`);
    const space = <Space | undefined>(await spaceDocRef.get()).data();
    if (!space) {
      throw throwInvalidArgument(WenError.space_does_not_exists);
    }

    const joinedMemberSnap = await spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner).get();
    if (joinedMemberSnap.exists) {
      throw throwInvalidArgument(WenError.you_are_already_part_of_space);
    }

    const blockedMemberSnap = await spaceDocRef
      .collection(SUB_COL.BLOCKED_MEMBERS)
      .doc(owner)
      .get();
    if (blockedMemberSnap.exists) {
      throw throwInvalidArgument(WenError.you_are_not_allowed_to_join_space);
    }

    const knockingMemberSnap = await spaceDocRef
      .collection(SUB_COL.KNOCKING_MEMBERS)
      .doc(owner)
      .get();
    if (knockingMemberSnap.exists) {
      throw throwInvalidArgument(WenError.member_already_knocking);
    }

    const joiningMemberDocRef = spaceDocRef
      .collection(space.open ? SUB_COL.MEMBERS : SUB_COL.KNOCKING_MEMBERS)
      .doc(owner);

    const data: SpaceMember = {
      uid: owner,
      parentId: params.body.uid,
      parentCol: COL.SPACE,
      createdOn: serverTime(),
    };
    await joiningMemberDocRef.set(data);

    spaceDocRef.update({
      totalMembers: admin.firestore.FieldValue.increment(space.open ? 1 : 0),
      totalPendingMembers: admin.firestore.FieldValue.increment(space.open ? 0 : 1),
    });

    return data;
  });

export const leaveSpace: functions.CloudFunction<Space> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.leaveSpace),
  })
  .https.onCall(
    async (
      req: WenRequest,
      context: functions.https.CallableContext,
    ): Promise<StandardResponse> => {
      appCheck(WEN_FUNC.leaveSpace, context);
      // Validate auth details before we continue
      const params: DecodedToken = await decodeAuth(req);
      const owner = params.address.toLowerCase();

      const schema: ObjectSchema<Space> = Joi.object(
        merge(getDefaultParams(), {
          uid: CommonJoi.uidCheck(),
        }),
      );
      assertValidation(schema.validate(params.body));

      const refSpace: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.SPACE)
        .doc(params.body.uid);
      await SpaceValidator.spaceExists(refSpace);

      // Validate guardian is an guardian within the space.
      if (!(await refSpace.collection(SUB_COL.MEMBERS).doc(owner).get()).exists) {
        throw throwInvalidArgument(WenError.you_are_not_part_of_the_space);
      }

      const isGuardian: boolean = (await refSpace.collection(SUB_COL.GUARDIANS).doc(owner).get())
        .exists;
      // Must be minimum one member.
      const members: admin.firestore.DocumentReference[] = await refSpace
        .collection(SUB_COL.MEMBERS)
        .listDocuments();
      if (members.length === 1) {
        throw throwInvalidArgument(WenError.at_least_one_member_must_be_in_the_space);
      }

      // Is last guardian? isGuardian
      const guardians: admin.firestore.DocumentReference[] = await refSpace
        .collection(SUB_COL.GUARDIANS)
        .listDocuments();
      if (guardians.length === 1 && isGuardian) {
        throw throwInvalidArgument(WenError.at_least_one_guardian_must_be_in_the_space);
      }

      if (params.body) {
        await refSpace.collection(SUB_COL.MEMBERS).doc(owner).delete();
        await admin.firestore().runTransaction(async (transaction) => {
          const sfDoc: DocumentSnapshotType = await transaction.get(refSpace);
          const totalMembers = (sfDoc.data().totalMembers || 0) - 1;
          const totalGuardians = (sfDoc.data().totalGuardians || 0) - (isGuardian ? 1 : 0);
          transaction.update(refSpace, {
            totalMembers: totalMembers,
            totalGuardians: totalGuardians,
          });
        });

        // If this member is always guardian he must be removed.
        if (isGuardian) {
          await refSpace.collection(SUB_COL.GUARDIANS).doc(owner).delete();
        }
      }

      return {
        status: 'success',
      };
    },
  );

export const addGuardian: functions.CloudFunction<Space> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.addGuardianSpace),
  })
  .https.onCall(
    async (
      req: WenRequest,
      context: functions.https.CallableContext,
    ): Promise<StandardResponse> => {
      appCheck(WEN_FUNC.addGuardianSpace, context);
      // Validate auth details before we continue
      const params: DecodedToken = await decodeAuth(req);
      const guardian = params.address.toLowerCase();

      const schema: ObjectSchema<Space> = Joi.object(
        merge(getDefaultParams(), {
          uid: CommonJoi.uidCheck(),
          member: CommonJoi.uidCheck(),
        }),
      );
      assertValidation(schema.validate(params.body));

      const refSpace: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.SPACE)
        .doc(params.body.uid);
      let docSpace!: DocumentSnapshotType;
      await SpaceValidator.spaceExists(refSpace);

      // Validate guardian is an guardian within the space.
      await SpaceValidator.isGuardian(refSpace, guardian);

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
          createdOn: serverTime(),
        });

        await admin.firestore().runTransaction(async (transaction) => {
          const sfDoc: DocumentSnapshotType = await transaction.get(refSpace);
          const totalGuardians = (sfDoc.data().totalGuardians || 0) + 1;
          transaction.update(refSpace, {
            totalGuardians: totalGuardians,
          });
        });

        // Load latest
        docSpace = await refSpace.collection(SUB_COL.GUARDIANS).doc(params.body.member).get();
      }

      return docSpace.data();
    },
  );

export const removeGuardian: functions.CloudFunction<Space> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.removeGuardianSpace),
  })
  .https.onCall(
    async (
      req: WenRequest,
      context: functions.https.CallableContext,
    ): Promise<StandardResponse> => {
      appCheck(WEN_FUNC.removeGuardianSpace, context);
      // Validate auth details before we continue
      const params: DecodedToken = await decodeAuth(req);
      const guardian = params.address.toLowerCase();

      const schema: ObjectSchema<Space> = Joi.object(
        merge(getDefaultParams(), {
          uid: CommonJoi.uidCheck(),
          member: CommonJoi.uidCheck(),
        }),
      );
      assertValidation(schema.validate(params.body));

      const refSpace: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.SPACE)
        .doc(params.body.uid);
      await SpaceValidator.spaceExists(refSpace);

      // Validate guardian is an guardian within the space.
      await SpaceValidator.isGuardian(refSpace, guardian);

      if (!(await refSpace.collection(SUB_COL.MEMBERS).doc(params.body.member).get()).exists) {
        throw throwInvalidArgument(WenError.member_is_not_part_of_the_space);
      }

      if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(params.body.member).get()).exists) {
        throw throwInvalidArgument(WenError.member_is_not_guardian_of_space);
      }

      const guardians: admin.firestore.DocumentData[] = await refSpace
        .collection(SUB_COL.GUARDIANS)
        .listDocuments();
      if (guardians.length === 1) {
        throw throwInvalidArgument(WenError.at_least_one_guardian_must_be_in_the_space);
      }

      if (params.body) {
        await refSpace.collection(SUB_COL.GUARDIANS).doc(params.body.member).delete();
        await admin.firestore().runTransaction(async (transaction) => {
          const sfDoc: DocumentSnapshotType = await transaction.get(refSpace);
          const totalGuardians = (sfDoc.data().totalGuardians || 0) - 1;
          transaction.update(refSpace, {
            totalGuardians: totalGuardians,
          });
        });
      }

      return {
        status: 'success',
      };
    },
  );

export const blockMember: functions.CloudFunction<Space> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.blockMemberSpace),
  })
  .https.onCall(
    async (
      req: WenRequest,
      context: functions.https.CallableContext,
    ): Promise<StandardResponse> => {
      appCheck(WEN_FUNC.blockMemberSpace, context);
      // Validate auth details before we continue
      const params: DecodedToken = await decodeAuth(req);
      const guardian = params.address.toLowerCase();

      const schema: ObjectSchema<Space> = Joi.object(
        merge(getDefaultParams(), {
          uid: CommonJoi.uidCheck(),
          member: CommonJoi.uidCheck(),
        }),
      );
      assertValidation(schema.validate(params.body));

      const refSpace = admin.firestore().collection(COL.SPACE).doc(params.body.uid);
      let docSpace!: DocumentSnapshotType;
      await SpaceValidator.spaceExists(refSpace);

      const isGuardian: boolean = (
        await refSpace.collection(SUB_COL.GUARDIANS).doc(params.body.member).get()
      ).exists;
      // Validate guardian is an guardian within the space.
      await SpaceValidator.isGuardian(refSpace, guardian);

      const isMember = (await refSpace.collection(SUB_COL.MEMBERS).doc(params.body.member).get())
        .exists;
      const isKnockingMember = (
        await refSpace.collection(SUB_COL.KNOCKING_MEMBERS).doc(params.body.member).get()
      ).exists;
      if (!isMember && !isKnockingMember) {
        throw throwInvalidArgument(WenError.member_is_not_part_of_the_space);
      }

      if (
        (await refSpace.collection(SUB_COL.BLOCKED_MEMBERS).doc(params.body.member).get()).exists
      ) {
        throw throwInvalidArgument(WenError.member_is_already_blocked);
      }

      // Must be minimum one member.
      const members: admin.firestore.QuerySnapshot = await refSpace
        .collection(SUB_COL.MEMBERS)
        .where('uid', '!=', params.body.member)
        .get();
      if (members.size === 0) {
        throw throwInvalidArgument(WenError.at_least_one_member_must_be_in_the_space);
      }

      // Is last guardian? isGuardian
      const guardians: admin.firestore.QuerySnapshot = await refSpace
        .collection(SUB_COL.GUARDIANS)
        .where('uid', '!=', params.body.member)
        .get();
      if (guardians.size === 0 && isGuardian) {
        throw throwInvalidArgument(WenError.at_least_one_guardian_must_be_in_the_space);
      }

      if (params.body) {
        await refSpace.collection(SUB_COL.BLOCKED_MEMBERS).doc(params.body.member).set({
          uid: params.body.member,
          parentId: params.body.uid,
          parentCol: COL.SPACE,
          createdOn: serverTime(),
        });

        if (isMember) {
          await refSpace.collection(SUB_COL.MEMBERS).doc(params.body.member).delete();
        }
        if (isKnockingMember) {
          await refSpace.collection(SUB_COL.KNOCKING_MEMBERS).doc(params.body.member).delete();
        }

        // If this member is always guardian he must be removed.
        if (isGuardian) {
          await refSpace.collection(SUB_COL.GUARDIANS).doc(params.body.member).delete();
        }

        await admin.firestore().runTransaction(async (transaction) => {
          const sfDoc = await transaction.get(refSpace);
          const totalPendingMembers =
            (sfDoc.data()?.totalPendingMembers || 0) - (isKnockingMember ? 1 : 0);
          const totalMembers = (sfDoc.data()?.totalMembers || 0) - (isKnockingMember ? 0 : 1);
          const totalGuardians =
            (sfDoc.data()?.totalGuardians || 0) - (isGuardian ? (isKnockingMember ? 0 : 1) : 0);
          transaction.update(refSpace, {
            totalGuardians: totalGuardians,
            totalMembers: totalMembers,
            totalPendingMembers: totalPendingMembers,
          });
        });

        // Load latest
        docSpace = await refSpace.collection(SUB_COL.BLOCKED_MEMBERS).doc(params.body.member).get();
      }

      return docSpace.data();
    },
  );

export const unblockMember: functions.CloudFunction<Space> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.unblockMemberSpace),
  })
  .https.onCall(
    async (
      req: WenRequest,
      context: functions.https.CallableContext,
    ): Promise<StandardResponse> => {
      appCheck(WEN_FUNC.unblockMemberSpace, context);
      // Validate auth details before we continue
      const params: DecodedToken = await decodeAuth(req);
      const guardian = params.address.toLowerCase();

      const schema: ObjectSchema<Space> = Joi.object(
        merge(getDefaultParams(), {
          uid: CommonJoi.uidCheck(),
          member: CommonJoi.uidCheck(),
        }),
      );
      assertValidation(schema.validate(params.body));

      const refSpace: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.SPACE)
        .doc(params.body.uid);
      await SpaceValidator.spaceExists(refSpace);

      // Validate guardian is an guardian within the space.
      await SpaceValidator.isGuardian(refSpace, guardian);

      if (
        !(await refSpace.collection(SUB_COL.BLOCKED_MEMBERS).doc(params.body.member).get()).exists
      ) {
        throw throwInvalidArgument(WenError.member_is_not_blocked_in_the_space);
      }

      if (params.body) {
        await refSpace.collection(SUB_COL.BLOCKED_MEMBERS).doc(params.body.member).delete();
      }

      return {
        status: 'success',
      };
    },
  );

export const acceptMemberSpace: functions.CloudFunction<Space> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.acceptMemberSpace),
  })
  .https.onCall(
    async (
      req: WenRequest,
      context: functions.https.CallableContext,
    ): Promise<StandardResponse> => {
      appCheck(WEN_FUNC.acceptMemberSpace, context);
      // Validate auth details before we continue
      const params: DecodedToken = await decodeAuth(req);
      const guardian = params.address.toLowerCase();

      const schema: ObjectSchema<Space> = Joi.object(
        merge(getDefaultParams(), {
          uid: CommonJoi.uidCheck(),
          member: CommonJoi.uidCheck(),
        }),
      );
      assertValidation(schema.validate(params.body));

      const refSpace = admin.firestore().collection(COL.SPACE).doc(params.body.uid);
      let docSpace!: DocumentSnapshotType;
      await SpaceValidator.spaceExists(refSpace);

      // Validate guardian is an guardian within the space.
      await SpaceValidator.isGuardian(refSpace, guardian);

      if (
        !(await refSpace.collection(SUB_COL.KNOCKING_MEMBERS).doc(params.body.member).get()).exists
      ) {
        throw throwInvalidArgument(WenError.member_did_not_request_to_join);
      }

      if (params.body) {
        await refSpace.collection(SUB_COL.MEMBERS).doc(params.body.member).set({
          uid: params.body.member,
          parentId: params.body.uid,
          parentCol: COL.SPACE,
          createdOn: serverTime(),
        });

        await refSpace.collection(SUB_COL.KNOCKING_MEMBERS).doc(params.body.member).delete();

        await admin.firestore().runTransaction(async (transaction) => {
          const sfDoc = await transaction.get(refSpace);
          const totalMembers = (sfDoc.data()?.totalMembers || 0) + 1;
          const totalPendingMembers = (sfDoc.data()?.totalPendingMembers || 0) - 1;
          transaction.update(refSpace, {
            totalMembers: totalMembers,
            totalPendingMembers: totalPendingMembers,
          });
        });

        // Load latest
        docSpace = await refSpace.collection(SUB_COL.MEMBERS).doc(params.body.member).get();
      }

      return docSpace.data();
    },
  );

export const declineMemberSpace: functions.CloudFunction<Space> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.declineMemberSpace),
  })
  .https.onCall(
    async (
      req: WenRequest,
      context: functions.https.CallableContext,
    ): Promise<StandardResponse> => {
      appCheck(WEN_FUNC.declineMemberSpace, context);
      // Validate auth details before we continue
      const params: DecodedToken = await decodeAuth(req);
      const guardian = params.address.toLowerCase();

      const schema: ObjectSchema<Space> = Joi.object(
        merge(getDefaultParams(), {
          uid: CommonJoi.uidCheck(),
          member: CommonJoi.uidCheck(),
        }),
      );
      assertValidation(schema.validate(params.body));

      const refSpace = admin.firestore().collection(COL.SPACE).doc(params.body.uid);
      await SpaceValidator.spaceExists(refSpace);
      await SpaceValidator.isGuardian(refSpace, guardian);

      if (
        !(await refSpace.collection(SUB_COL.KNOCKING_MEMBERS).doc(params.body.member).get()).exists
      ) {
        throw throwInvalidArgument(WenError.member_did_not_request_to_join);
      }

      if (params.body) {
        await refSpace.collection(SUB_COL.KNOCKING_MEMBERS).doc(params.body.member).delete();
      }

      return {
        status: 'success',
      };
    },
  );
