import {
  COL,
  MAX_IOTA_AMOUNT,
  MAX_TOTAL_TOKEN_SUPPLY,
  MIN_IOTA_AMOUNT,
  SUB_COL,
  Token,
  TokenTradeOrderType,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import bigDecimal from 'js-big-decimal';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { createTokenTradeOrder } from '../../services/payment/tangle-service/token-trade.service';
import { cOn, uOn } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { getTokenBySymbol } from '../../utils/token.utils';
import { decodeAuth } from '../../utils/wallet.utils';

export const tradeTokenSchema = Joi.object({
  symbol: CommonJoi.tokenSymbol(),
  count: Joi.number().min(1).max(MAX_TOTAL_TOKEN_SUPPLY).integer().required(),
  price: Joi.number().min(0.001).max(MAX_IOTA_AMOUNT).precision(3).required(),
  type: Joi.string().equal(TokenTradeOrderType.SELL, TokenTradeOrderType.BUY).required(),
}).custom((obj, helper) => {
  if (Number(bigDecimal.multiply(obj.price, obj.count)) < MIN_IOTA_AMOUNT) {
    return helper.error('Order total min value is: ' + MIN_IOTA_AMOUNT);
  }
  return obj;
});

export const tradeToken = functions
  .runWith({
    minInstances: scale(WEN_FUNC.tradeToken),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.tradeToken, context);
    const params = await decodeAuth(req, WEN_FUNC.tradeToken);
    const owner = params.address.toLowerCase();
    await assertValidationAsync(tradeTokenSchema, params.body, { convert: false });

    let token = await getTokenBySymbol(params.body.symbol);

    return await admin.firestore().runTransaction(async (transaction) => {
      const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token?.uid}`);
      token = <Token | undefined>(await transaction.get(tokenDocRef)).data();
      if (!token) {
        throw throwInvalidArgument(WenError.token_does_not_exist);
      }
      if (token.tradingDisabled) {
        throw throwInvalidArgument(WenError.token_trading_disabled);
      }

      const { tradeOrderTransaction, tradeOrder, distribution } = await createTokenTradeOrder(
        transaction,
        owner,
        token,
        params.body.type,
        params.body.count,
        params.body.price,
        context.rawRequest?.ip,
      );
      if (tradeOrder) {
        const orderDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${tradeOrder.uid}`);
        transaction.create(orderDocRef, cOn(tradeOrder));
        const distributionDocRef = admin
          .firestore()
          .doc(`${COL.TOKEN}/${token?.uid}/${SUB_COL.DISTRIBUTION}/${owner}`);
        transaction.update(distributionDocRef, uOn(distribution));
      } else {
        const tranDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${tradeOrderTransaction.uid}`);
        transaction.create(tranDocRef, cOn(tradeOrderTransaction));
      }
      return tradeOrder || tradeOrderTransaction;
    });
  });
