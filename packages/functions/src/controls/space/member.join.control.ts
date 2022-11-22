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
import { cOn, serverTime, uOn } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidation } from '../../utils/schema.utils';
import { decodeAuth } from '../../utils/wallet.utils';

export const joinSpace = functions
  .runWith({
    minInstances: scale(WEN_FUNC.joinSpace),
  })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.joinSpace, context);
    const params = await decodeAuth(req);
    const owner = params.address.toLowerCase();

    const schema = Joi.object({
      uid: CommonJoi.uid(),
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
    await joiningMemberDocRef.set(cOn(data));

    spaceDocRef.update(
      uOn({
        totalMembers: inc(space.open ? 1 : 0),
        totalPendingMembers: inc(space.open ? 0 : 1),
      }),
    );

    return data;
  });
