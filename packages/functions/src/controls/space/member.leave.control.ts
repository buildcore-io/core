import {
  COL,
  Space,
  StandardResponse,
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
import { uOn } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { decodeAuth } from '../../utils/wallet.utils';

export const leaveSpace = functions
  .runWith({
    minInstances: scale(WEN_FUNC.leaveSpace),
  })
  .https.onCall(async (req: WenRequest, context): Promise<StandardResponse> => {
    appCheck(WEN_FUNC.leaveSpace, context);
    const params = await decodeAuth(req, WEN_FUNC.leaveSpace);
    const owner = params.address.toLowerCase();

    const schema = Joi.object({ uid: CommonJoi.uid() });
    await assertValidationAsync(schema, params.body);

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${params.body.uid}`);

    const spaceMember = await spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner).get();
    if (!spaceMember.exists) {
      throw throwInvalidArgument(WenError.you_are_not_part_of_the_space);
    }

    const space = <Space>(await spaceDocRef.get()).data();
    if (space.totalMembers === 1) {
      throw throwInvalidArgument(WenError.at_least_one_member_must_be_in_the_space);
    }

    const guardianDoc = await spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner).get();
    const isGuardian = guardianDoc.exists;
    if (space.totalGuardians === 1 && isGuardian) {
      throw throwInvalidArgument(WenError.at_least_one_guardian_must_be_in_the_space);
    }

    const batch = admin.firestore().batch();
    batch.delete(spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner));
    batch.delete(spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner));
    batch.update(
      spaceDocRef,
      uOn({
        totalMembers: inc(-1),
        totalGuardians: inc(isGuardian ? -1 : 0),
      }),
    );
    const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${owner}`);
    batch.set(
      memberDocRef,
      { spaces: { [space.uid]: { uid: space.uid, isMember: false } } },
      { merge: true },
    );

    await batch.commit();

    return { status: 'success' };
  });
