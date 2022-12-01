import {
  COL,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { cancelTradeOrderUtil } from '../../utils/token-trade.utils';
import { decodeAuth } from '../../utils/wallet.utils';

export const cancelTradeOrder = functions
  .runWith({
    minInstances: scale(WEN_FUNC.cancelTradeOrder),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.cancelTradeOrder, context);
    const params = await decodeAuth(req, WEN_FUNC.cancelTradeOrder);
    const owner = params.address.toLowerCase();
    const schema = Joi.object({ uid: CommonJoi.uid() });
    await assertValidationAsync(schema, params.body);

    return await admin.firestore().runTransaction(async (transaction) => {
      const tradeOrderDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${params.body.uid}`);
      const tradeOrder = <TokenTradeOrder | undefined>(
        (await transaction.get(tradeOrderDocRef)).data()
      );
      if (
        !tradeOrder ||
        tradeOrder.owner !== owner ||
        tradeOrder.status !== TokenTradeOrderStatus.ACTIVE
      ) {
        throw throwInvalidArgument(WenError.invalid_params);
      }
      return await cancelTradeOrderUtil(transaction, tradeOrder);
    });
  });
