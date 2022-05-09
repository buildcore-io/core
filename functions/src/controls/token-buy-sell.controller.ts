import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { MAX_IOTA_AMOUNT, MAX_TOTAL_TOKEN_SUPPLY, URL_PATHS } from '../../interfaces/config';
import { WenError } from '../../interfaces/errors';
import { WEN_FUNC } from '../../interfaces/functions';
import { Transaction, TransactionOrderType, TransactionType, TransactionValidationType, TRANSACTION_AUTO_EXPIRY_MS } from '../../interfaces/models';
import { COL, SUB_COL, WenRequest } from '../../interfaces/models/base';
import { TokenBuySellOrder, TokenBuySellOrderStatus, TokenBuySellOrderType, TokenDistribution } from '../../interfaces/models/token';
import { scale } from "../scale.settings";
import { WalletService } from '../services/wallet/wallet';
import { cOn, dateToTimestamp, serverTime, uOn } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertValidation } from '../utils/schema.utils';
import { creditBuyer } from '../utils/token-buy-sell.utils';
import { decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';

const buySellTokenSchema = {
  token: Joi.string().required(),
  count: Joi.number().min(1).max(MAX_TOTAL_TOKEN_SUPPLY).integer().required(),
  price: Joi.number().min(0.01).max(MAX_IOTA_AMOUNT).precision(2).required()
}

export const sellToken = functions.runWith({
  minInstances: scale(WEN_FUNC.sellToken),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.cSpace, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema = Joi.object(buySellTokenSchema);
  assertValidation(schema.validate(params.body));

  const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}/${SUB_COL.DISTRIBUTION}/${owner}`);
  const sellDocId = getRandomEthAddress();
  const sellDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${sellDocId}`);

  await admin.firestore().runTransaction(async (transaction) => {
    const distributionDoc = await transaction.get(distributionDocRef)
    if (!distributionDoc.exists) {
      throw throwInvalidArgument(WenError.invalid_params)
    }
    const distribution = <TokenDistribution>distributionDoc.data();
    const tokensSold = (distribution.sold || 0) + (distribution.lockedForSale || 0);
    const tokensLeftForSale = distribution.tokenOwned! - tokensSold;
    if (params.body.count > tokensLeftForSale) {
      throw throwInvalidArgument(WenError.no_available_tokens_for_sale)
    }
    const data = cOn(<TokenBuySellOrder>{
      uid: sellDocId,
      owner,
      token: params.body.token,
      type: TokenBuySellOrderType.SELL,
      count: params.body.count,
      price: params.body.price,
      fulfilled: 0,
      status: TokenBuySellOrderStatus.ACTIVE,
    }, URL_PATHS.TOKEN_MARKET)
    transaction.create(sellDocRef, data)
    transaction.update(distributionDocRef, { lockedForSale: admin.firestore.FieldValue.increment(params.body.count) })
  });
  return <TokenBuySellOrder>(await sellDocRef.get()).data()
})


export const cancelBuyOrSell = functions.runWith({
  minInstances: scale(WEN_FUNC.cancelBuyOrSell),
}).https.onCall(async (req: WenRequest) => admin.firestore().runTransaction(async (transaction) => {
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema = Joi.object({ uid: Joi.string().required() });
  assertValidation(schema.validate(params.body));

  const saleDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${params.body.uid}`)
  const sale = <TokenBuySellOrder | undefined>(await transaction.get(saleDocRef)).data()
  if (!sale || sale.owner !== owner || sale.status !== TokenBuySellOrderStatus.ACTIVE) {
    throw throwInvalidArgument(WenError.invalid_params)
  }

  transaction.update(saleDocRef, uOn({ status: TokenBuySellOrderStatus.CANCELLED }))

  if (sale.type === TokenBuySellOrderType.SELL) {
    const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${sale.token}/${SUB_COL.DISTRIBUTION}/${sale.owner}`)
    transaction.update(distributionDocRef, uOn({ lockedForSale: 0 }))
  } else {
    await creditBuyer(sale, [], transaction)
  }

  return { ...sale, status: TokenBuySellOrderStatus.CANCELLED }
}))

export const buyToken = functions.runWith({
  minInstances: scale(WEN_FUNC.sellToken),
}).https.onCall(async (req: WenRequest) => {
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema = Joi.object(buySellTokenSchema);
  assertValidation(schema.validate(params.body));

  const tokenDoc = await admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`).get();
  if (!tokenDoc.exists) {
    throw throwInvalidArgument(WenError.invalid_params)
  }

  const tranId = getRandomEthAddress();
  const newWallet = new WalletService();
  const targetAddress = await newWallet.getNewIotaAddressDetails();
  const orderDoc = admin.firestore().collection(COL.TRANSACTION).doc(tranId)

  const data = <Transaction>{
    type: TransactionType.ORDER,
    uid: tranId,
    member: owner,
    space: tokenDoc.data()?.space,
    createdOn: serverTime(),
    payload: {
      type: TransactionOrderType.TOKEN_BUY,
      amount: params.body.count * params.body.price,
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      chainReference: null,
      ...params.body,
    },
    linkedTransactions: []
  }
  await orderDoc.create(data);
  return <Transaction>(await orderDoc.get()).data()
})
