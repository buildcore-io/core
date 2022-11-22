import { COL, Space, SUB_COL, WenError, WenRequest, WEN_FUNC } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { uOn } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidation, pSchema } from '../../utils/schema.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { decodeAuth } from '../../utils/wallet.utils';
import { spaceUpsertSchema } from './space.create.control';

export const updateSpace = functions
  .runWith({
    minInstances: scale(WEN_FUNC.uSpace),
  })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.uSpace, context);
    const params = await decodeAuth(req);
    const owner = params.address.toLowerCase();

    const schema = Joi.object({
      ...spaceUpsertSchema,
      uid: CommonJoi.uid(),
    });
    assertValidation(schema.validate(params.body));

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${params.body.uid}`);
    const space = <Space | undefined>(await spaceDocRef.get()).data();

    if (!space) {
      throw throwInvalidArgument(WenError.space_does_not_exists);
    }

    await assertIsGuardian(space.uid, owner);

    if (params.body.open) {
      const knockingMembersSnap = await spaceDocRef.collection(SUB_COL.KNOCKING_MEMBERS).get();
      const deleteKnockingMemberPromise = knockingMembersSnap.docs.map((d) => d.ref.delete());
      await Promise.all(deleteKnockingMemberPromise);
    }

    const data = pSchema(schema, params.body);
    const updateData = params.body.open ? { ...data, totalPendingMembers: 0 } : data;
    await spaceDocRef.update(uOn(updateData));

    return <Space>(await spaceDocRef.get()).data();
  });
