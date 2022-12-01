import { COL, SpaceMember, SUB_COL, WenError, WenRequest, WEN_FUNC } from '@soonaverse/interfaces';
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

export const acceptMemberSpace = functions
  .runWith({
    minInstances: scale(WEN_FUNC.acceptMemberSpace),
  })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.acceptMemberSpace, context);
    const params = await decodeAuth(req, WEN_FUNC.acceptMemberSpace);
    const owner = params.address.toLowerCase();

    const schema = Joi.object({
      uid: CommonJoi.uid(),
      member: CommonJoi.uid(),
    });
    await assertValidationAsync(schema, params.body);

    await assertIsGuardian(params.body.uid, owner);

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${params.body.uid}`);
    const knockingMember = await spaceDocRef
      .collection(SUB_COL.KNOCKING_MEMBERS)
      .doc(params.body.member)
      .get();
    if (!knockingMember.exists) {
      throw throwInvalidArgument(WenError.member_did_not_request_to_join);
    }

    const memberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(params.body.member);
    const batch = admin.firestore().batch();
    batch.set(
      memberDocRef,
      cOn({
        uid: params.body.member,
        parentId: params.body.uid,
        parentCol: COL.SPACE,
      }),
    );
    batch.delete(spaceDocRef.collection(SUB_COL.KNOCKING_MEMBERS).doc(params.body.member));
    batch.update(
      spaceDocRef,
      uOn({
        totalMembers: inc(1),
        totalPendingMembers: inc(-1),
      }),
    );
    await batch.commit();

    return <SpaceMember>(await memberDocRef.get()).data();
  });
