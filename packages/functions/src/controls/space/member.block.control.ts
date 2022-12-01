import {
  COL,
  Space,
  SpaceMember,
  SUB_COL,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin, { inc } from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { cOn, uOn } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { decodeAuth } from '../../utils/wallet.utils';

export const blockMember = functions
  .runWith({
    minInstances: scale(WEN_FUNC.blockMemberSpace),
  })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.blockMemberSpace, context);
    const params = await decodeAuth(req, WEN_FUNC.blockMemberSpace);
    const owner = params.address.toLowerCase();

    const schema = Joi.object({
      uid: CommonJoi.uid(),
      member: CommonJoi.uid(),
    });
    await assertValidationAsync(schema, params.body);

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${params.body.uid}`);
    await assertIsGuardian(params.body.uid, owner);

    const member = await spaceDocRef.collection(SUB_COL.MEMBERS).doc(params.body.member).get();
    const knockingMember = await spaceDocRef
      .collection(SUB_COL.KNOCKING_MEMBERS)
      .doc(params.body.member)
      .get();
    if (!member.exists && !knockingMember.exists) {
      throw throwInvalidArgument(WenError.member_is_not_part_of_the_space);
    }

    const blockedMemberDocRef = spaceDocRef
      .collection(SUB_COL.BLOCKED_MEMBERS)
      .doc(params.body.member);
    const blockedMember = await blockedMemberDocRef.get();
    if (blockedMember.exists) {
      throw throwInvalidArgument(WenError.member_is_already_blocked);
    }

    const space = <Space>(await spaceDocRef.get()).data();
    if (space.totalMembers === 1) {
      throw throwInvalidArgument(WenError.at_least_one_member_must_be_in_the_space);
    }
    if (space.totalGuardians === 1) {
      const guardian = await spaceDocRef
        .collection(SUB_COL.GUARDIANS)
        .doc(params.body.member)
        .get();
      if (guardian.exists) {
        throw throwInvalidArgument(WenError.at_least_one_guardian_must_be_in_the_space);
      }
    }

    const batch = admin.firestore().batch();
    batch.set(
      blockedMemberDocRef,
      cOn({
        uid: params.body.member,
        parentId: params.body.uid,
        parentCol: COL.SPACE,
      }),
    );
    batch.delete(spaceDocRef.collection(SUB_COL.MEMBERS).doc(params.body.member));
    batch.delete(spaceDocRef.collection(SUB_COL.KNOCKING_MEMBERS).doc(params.body.member));
    batch.delete(spaceDocRef.collection(SUB_COL.GUARDIANS).doc(params.body.member));
    batch.update(
      spaceDocRef,
      uOn({
        totalGuardians: inc(knockingMember.exists ? 0 : -1),
        totalMembers: inc(knockingMember.exists ? 0 : -1),
        totalPendingMembers: inc(knockingMember.exists ? -1 : 0),
      }),
    );
    await batch.commit();

    return <SpaceMember>(await blockedMemberDocRef.get()).data();
  });
