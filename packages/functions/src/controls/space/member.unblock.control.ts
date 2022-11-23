import {
  COL,
  Space,
  StandardResponse,
  SUB_COL,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { appCheck } from '../../utils/google.utils';
import { assertValidation } from '../../utils/schema.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { decodeAuth } from '../../utils/wallet.utils';

export const unblockMember: functions.CloudFunction<Space> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.unblockMemberSpace),
  })
  .https.onCall(async (req: WenRequest, context): Promise<StandardResponse> => {
    appCheck(WEN_FUNC.unblockMemberSpace, context);
    const params = await decodeAuth(req);
    const owner = params.address.toLowerCase();

    const schema = Joi.object({
      uid: CommonJoi.uid(),
      member: CommonJoi.uid(),
    });
    assertValidation(schema.validate(params.body));

    await assertIsGuardian(params.body.uid, owner);

    await admin
      .firestore()
      .doc(`${COL.SPACE}/${params.body.uid}/${SUB_COL.BLOCKED_MEMBERS}/${params.body.member}`)
      .delete();

    return { status: 'success' };
  });
