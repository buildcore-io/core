import * as functions from 'firebase-functions';
import Joi from 'joi';
import { WenError } from '../../../interfaces/errors';
import { WEN_FUNC } from '../../../interfaces/functions';
import { COL, WenRequest } from '../../../interfaces/models/base';
import { TokenTradeOrder, TokenTradeOrderStatus } from '../../../interfaces/models/token';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidation } from '../../utils/schema.utils';
import { cancelTradeOrderUtil } from '../../utils/token-trade.utils';
import { decodeAuth } from '../../utils/wallet.utils';

export const cancelTradeOrder = functions
  .runWith({
    minInstances: scale(WEN_FUNC.cancelTradeOrder),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.cancelTradeOrder, context);
    const params = await decodeAuth(req);
    const owner = params.address.toLowerCase();
    const schema = Joi.object({ uid: CommonJoi.uid() });
    assertValidation(schema.validate(params.body));

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
