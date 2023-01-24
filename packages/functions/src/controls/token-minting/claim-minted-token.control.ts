import { COL, WenRequest, WEN_FUNC } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { createMintedTokenAirdropCalimOrder } from '../../services/payment/tangle-service/token-claim.service';
import { cOn } from '../../utils/dateTime.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { decodeAuth } from '../../utils/wallet.utils';

export const claimMintedTokenOrder = functions
  .runWith({
    minInstances: scale(WEN_FUNC.claimMintedTokenOrder),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.claimMintedTokenOrder, context);
    const params = await decodeAuth(req, WEN_FUNC.claimMintedTokenOrder);
    const owner = params.address.toLowerCase();

    const schema = Joi.object({ symbol: CommonJoi.tokenSymbol() });
    await assertValidationAsync(schema, params.body);

    const order = await createMintedTokenAirdropCalimOrder(owner, params.body.symbol);
    await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
    return order;
  });
