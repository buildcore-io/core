import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import bigDecimal from 'js-big-decimal';
import { MAX_IOTA_AMOUNT, MAX_TOTAL_TOKEN_SUPPLY, MIN_IOTA_AMOUNT, URL_PATHS } from '../../interfaces/config';
import { WenError } from '../../interfaces/errors';
import { WEN_FUNC } from '../../interfaces/functions';
import { Member, Transaction, TransactionOrderType, TransactionType, TransactionValidationType, TRANSACTION_AUTO_EXPIRY_MS, TRANSACTION_MAX_EXPIRY_MS } from '../../interfaces/models';
import { COL, SUB_COL, WenRequest } from '../../interfaces/models/base';
import { Token, TokenBuySellOrder, TokenBuySellOrderStatus, TokenBuySellOrderType, TokenDistribution } from '../../interfaces/models/token';
import admin from '../admin.config';
import { scale } from "../scale.settings";
import { MnemonicService } from '../services/wallet/mnemonic';
import { WalletService } from '../services/wallet/wallet';
import { isProdEnv } from '../utils/config.utils';
import { cOn, dateToTimestamp, serverTime } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertIpNotBlocked } from '../utils/ip.uitls';
import { assertValidation } from '../utils/schema.utils';
import { cancelSale } from '../utils/token-buy-sell.utils';
import { assertTokenApproved } from '../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';

const buySellTokenSchema = Joi.object({
  token: Joi.string().required(),
  count: Joi.number().min(1).max(MAX_TOTAL_TOKEN_SUPPLY).integer().required(),
  price: Joi.number().min(0.001).max(MAX_IOTA_AMOUNT).precision(3).required()
}).custom((obj, helper) => {
  if (Number(bigDecimal.multiply(obj.price, obj.count)) < MIN_IOTA_AMOUNT) {
    return helper.error('Order total min value is: ' + MIN_IOTA_AMOUNT);
  }
  return obj
});

export const sellToken = functions.runWith({
  minInstances: scale(WEN_FUNC.sellToken),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.sellToken, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  assertValidation(buySellTokenSchema.validate(params.body, { convert: false }));

  const member = <Member | undefined>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
  if (!member?.validatedAddress) {
    throw throwInvalidArgument(WenError.member_must_have_validated_address)
  }

  const token = <Token | undefined>(await admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`).get()).data()
  if (!token) {
    throw throwInvalidArgument(WenError.invalid_params);
  }

  if (isProdEnv) {
    await assertIpNotBlocked(context.rawRequest?.ip || '', token.uid)
  }

  assertTokenApproved(token);

  const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}/${SUB_COL.DISTRIBUTION}/${owner}`);
  const sellDocId = getRandomEthAddress();
  const sellDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${sellDocId}`);

  await admin.firestore().runTransaction(async (transaction) => {
    const distributionDoc = await transaction.get(distributionDocRef)
    if (!distributionDoc.exists) {
      throw throwInvalidArgument(WenError.invalid_params)
    }
    const distribution = <TokenDistribution>distributionDoc.data();
    const tokensLeftForSale = (distribution.tokenOwned || 0) - (distribution.lockedForSale || 0);
    if (params.body.count > tokensLeftForSale) {
      throw throwInvalidArgument(WenError.no_available_tokens_for_sale)
    }
    const data = cOn(<TokenBuySellOrder>{
      uid: sellDocId,
      owner,
      token: params.body.token,
      type: TokenBuySellOrderType.SELL,
      count: Number(params.body.count),
      price: Number(params.body.price),
      totalDeposit: Number(bigDecimal.floor(bigDecimal.multiply(params.body.count, params.body.price))),
      balance: 0,
      fulfilled: 0,
      status: TokenBuySellOrderStatus.ACTIVE,
      expiresAt: dateToTimestamp(dayjs().add(TRANSACTION_MAX_EXPIRY_MS, 'ms'))
    }, URL_PATHS.TOKEN_MARKET)
    transaction.create(sellDocRef, data)
    transaction.update(distributionDocRef, { lockedForSale: admin.firestore.FieldValue.increment(Number(params.body.count)) })
  });
  return <TokenBuySellOrder>(await sellDocRef.get()).data()
})


export const cancelBuyOrSell = functions.runWith({
  minInstances: scale(WEN_FUNC.cancelBuyOrSell),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.cancelBuyOrSell, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema = Joi.object({ uid: Joi.string().required() });
  assertValidation(schema.validate(params.body));
  return await admin.firestore().runTransaction(async transaction => {
    const saleDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${params.body.uid}`)
    const sale = <TokenBuySellOrder | undefined>(await transaction.get(saleDocRef)).data()
    if (!sale || sale.owner !== owner || sale.status !== TokenBuySellOrderStatus.ACTIVE) {
      throw throwInvalidArgument(WenError.invalid_params)
    }
    return await cancelSale(transaction, sale)
  })
})

export const buyToken = functions.runWith({
  minInstances: scale(WEN_FUNC.buyToken),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.buyToken, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  assertValidation(buySellTokenSchema.validate(params.body, { convert: false }));

  const member = <Member | undefined>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
  if (!member?.validatedAddress) {
    throw throwInvalidArgument(WenError.member_must_have_validated_address)
  }

  const token = <Token | undefined>(await admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`).get()).data();
  if (!token) {
    throw throwInvalidArgument(WenError.invalid_params)
  }

  if (isProdEnv) {
    await assertIpNotBlocked(context.rawRequest?.ip || '', token.uid)
  }

  assertTokenApproved(token);

  const tranId = getRandomEthAddress();
  const newWallet = new WalletService();
  const targetAddress = await newWallet.getNewIotaAddressDetails();
  const orderDoc = admin.firestore().collection(COL.TRANSACTION).doc(tranId)

  const data = <Transaction>{
    type: TransactionType.ORDER,
    uid: tranId,
    member: owner,
    space: token.space,
    createdOn: serverTime(),
    payload: {
      type: TransactionOrderType.TOKEN_BUY,
      amount: Number(bigDecimal.floor(bigDecimal.multiply(params.body.count, params.body.price))),
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      chainReference: null,
      token: params.body.token,
      count: Number(params.body.count),
      price: Number(params.body.price)
    },
    linkedTransactions: []
  }
  await MnemonicService.store(targetAddress.bech32, targetAddress.mnemonic);
  await orderDoc.create(data);
  return <Transaction>(await orderDoc.get()).data()
})
