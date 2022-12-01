import { COL, SUB_COL, WenRequest, WEN_FUNC } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { decodeAuth } from '../../utils/wallet.utils';

export const declineMemberSpace = functions
  .runWith({
    minInstances: scale(WEN_FUNC.declineMemberSpace),
  })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.declineMemberSpace, context);
    const params = await decodeAuth(req, WEN_FUNC.declineMemberSpace);
    const owner = params.address.toLowerCase();

    const schema = Joi.object({
      uid: CommonJoi.uid(),
      member: CommonJoi.uid(),
    });
    await assertValidationAsync(schema, params.body);

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${params.body.uid}`);
    await assertIsGuardian(params.body.uid, owner);

    await spaceDocRef.collection(SUB_COL.KNOCKING_MEMBERS).doc(params.body.member).delete();

    return { status: 'success' };
  });
