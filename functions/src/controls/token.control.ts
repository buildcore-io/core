import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi from "joi";
import { merge } from 'lodash';
import { MAX_IOTA_AMOUNT, MAX_TOTAL_TOKEN_SUPLY, MIN_IOTA_AMOUNT, MIN_TOKEN_START_DATE_DAY, MIN_TOTAL_TOKEN_SUPLY, URL_PATHS } from '../../interfaces/config';
import { WenError } from '../../interfaces/errors';
import { WEN_FUNC } from '../../interfaces/functions';
import { Member, Space, Transaction, TransactionOrderType, TransactionType, TransactionValidationType, TRANSACTION_AUTO_EXPIRY_MS, TRANSACTION_MAX_EXPIRY_MS } from '../../interfaces/models';
import { COL, SUB_COL, Timestamp, WenRequest } from '../../interfaces/models/base';
import { scale } from "../scale.settings";
import { WalletService } from '../services/wallet/wallet';
import { cOn, dateToTimestamp, serverTime, uOn } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from "../utils/google.utils";
import { keywords } from '../utils/keywords.utils';
import { assertValidation } from '../utils/schema.utils';
import { cleanParams, decodeAuth, getRandomEthAddress } from "../utils/wallet.utils";
import { Token, TokenAllocation, TokenStatus } from './../../interfaces/models/token';

const assertIsGuardian = async (space: string, member: string) => {
  const guardianDoc = (await admin.firestore().doc(`${COL.SPACE}/${space}/${SUB_COL.GUARDIANS}/${member}`).get());
  if (!guardianDoc.exists) {
    throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
  }
}

const createSchema = () => ({
  name: Joi.string().required(),
  symbol: Joi.string().required().length(4).regex(RegExp('^[A-Z]+$')),
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  space: Joi.string().required(),
  pricePerToken: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required(),
  totalSupply: Joi.number().required().min(MIN_TOTAL_TOKEN_SUPLY).max(MAX_TOTAL_TOKEN_SUPLY).integer(),
  allocations: Joi.array().required().items(Joi.object().keys({
    title: Joi.string().required(),
    percentage: Joi.number().min(0.01).max(100).precision(2).required(),
    isPublicSale: Joi.boolean().optional()
  })).min(1).custom((allocations: TokenAllocation[], helpers) => {
    const publicSaleCount = allocations.filter(a => a.isPublicSale).length
    if (publicSaleCount > 1) {
      return helpers.error('Only one public sale is allowed');
    }
    const total = allocations.reduce((acc, act) => acc + act.percentage, 0)
    if (total !== 100) {
      return helpers.error('Allocations percentage sum must be 100');
    }
    return allocations;
  }),
  saleStartDate: Joi.date().greater(dayjs().add(MIN_TOKEN_START_DATE_DAY, 'd').toDate()).optional(),
  saleLength: Joi.number().min(TRANSACTION_AUTO_EXPIRY_MS).max(TRANSACTION_MAX_EXPIRY_MS).optional(),
  links: Joi.array().min(0).items(Joi.string().uri()),
  icon: Joi.string().required(),
  overviewGraphics: Joi.string().required(),
})

export const createToken = functions.runWith({
  minInstances: scale(WEN_FUNC.cToken),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.cSpace, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();

  const schema = Joi.object(createSchema());
  assertValidation(schema.validate(params.body));

  const snapshot = await admin.firestore().collection(COL.TOKENS).where('space', '==', params.body.space).get()
  if (snapshot.size > 0) {
    throw throwInvalidArgument(WenError.token_already_exists_for_space);
  }

  const symbolSnapshot = await admin.firestore().collection(COL.TOKENS).where('symbol', '==', params.body.symbol).get();
  if (symbolSnapshot.size > 0) {
    throw throwInvalidArgument(WenError.token_symbol_must_be_globally_unique);
  }

  await assertIsGuardian(params.body.space, owner)

  const hasPublicSale = (<TokenAllocation[]>params.body.allocations).filter(a => a.isPublicSale).length > 0
  if (hasPublicSale && (params.body.saleStartDate === undefined || params.body.saleLength === undefined)) {
    throw throwInvalidArgument(WenError.invalid_params);
  }

  const tokenUid: string = getRandomEthAddress();
  params.body.saleStartDate = dateToTimestamp(params.body.saleStartDate)
  const coolDownEnd = dayjs((<Timestamp>params.body.saleStartDate).toDate()).add(params.body.saleLength, 'ms').add(2, 'd')
  const token = { uid: tokenUid, createdBy: owner, pending: true, status: TokenStatus.READY, coolDownEnd: dateToTimestamp(coolDownEnd) }
  const data = keywords(cOn(merge(cleanParams(params.body), token), URL_PATHS.TOKEN))
  await admin.firestore().collection(COL.TOKENS).doc(tokenUid).set(data);
  return <Token>(await admin.firestore().doc(`${COL.TOKENS}/${tokenUid}`).get()).data()
})

const updateSchema = {
  name: Joi.string().required().allow(null, ''),
  title: Joi.string().required().allow(null, ''),
  description: Joi.string().required().allow(null, ''),
  uid: Joi.string().required()
}

export const updateToken = functions.runWith({
  minInstances: scale(WEN_FUNC.uToken),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.cSpace, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();

  const schema = Joi.object(updateSchema);
  assertValidation(schema.validate(params.body));

  const tokenDocRef = admin.firestore().doc(`${COL.TOKENS}/${params.body.uid}`);
  const data = (await tokenDocRef.get()).data()

  if (!data) {
    throw throwInvalidArgument(WenError.invalid_params)
  }

  await assertIsGuardian(data.space, owner)

  await tokenDocRef.update(uOn(params.body))
  return <Token>(await tokenDocRef.get()).data()
})

const tokenOrderIsWithinPublicSalePeriod = (token: Token) => token.saleStartDate && token.saleLength &&
  dayjs().isAfter(dayjs(token.saleStartDate?.toDate())) && dayjs().isBefore(dayjs(token.saleStartDate.toDate()).add(token.saleLength, 'ms'))


const tokenInSaleOrCoolDownPeriod = (token: Token) => token.saleStartDate && token.saleLength &&
  dayjs().isAfter(dayjs(token.saleStartDate.toDate())) &&
  dayjs().isBefore(dayjs(token.saleStartDate.toDate()).add(token.saleLength, 'ms').add(2, 'd'))

const orderOrCreditTokenSchema = ({
  token: Joi.string().required(),
  amount: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required()
})

export const orderToken = functions.runWith({
  minInstances: scale(WEN_FUNC.openBid),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.orderToken, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema = Joi.object(orderOrCreditTokenSchema);
  assertValidation(schema.validate(params.body));

  const token = <Token | undefined>(await admin.firestore().doc(`${COL.TOKENS}/${params.body.token}`).get()).data()
  if (!token) {
    throw throwInvalidArgument(WenError.invalid_params)
  }
  if (!tokenOrderIsWithinPublicSalePeriod(token)) {
    throw throwInvalidArgument(WenError.no_token_public_sale)
  }

  const space = (await admin.firestore().doc(`${COL.SPACE}/${token.space}`).get()).data()
  const newWallet = new WalletService();
  const targetAddress = await newWallet.getNewIotaAddressDetails();
  const tranId = getRandomEthAddress();
  const orderDoc = admin.firestore().collection(COL.TRANSACTION).doc(tranId)

  await orderDoc.set(<Transaction>{
    type: TransactionType.ORDER,
    uid: tranId,
    member: owner,
    space: token.space,
    createdOn: serverTime(),
    payload: {
      type: TransactionOrderType.TOKEN_PURCHASE,
      amount: params.body.amount,
      targetAddress: targetAddress.bech32,
      beneficiary: 'space',
      beneficiaryUid: token.space,
      beneficiaryAddress: space?.validatedAddress,
      expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      chainReference: null,
      token: token.uid
    },
    linkedTransactions: []
  });

  return <Transaction>(await orderDoc.get()).data()
});

export const creditToken = functions.runWith({
  minInstances: scale(WEN_FUNC.creditToken),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.orderToken, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema = Joi.object(orderOrCreditTokenSchema);
  assertValidation(schema.validate(params.body));

  const purchaseDocRef = admin.firestore().doc(`${COL.TOKENS}/${params.body.token}/${SUB_COL.PURCHASES}/${owner}`)
  const purchase = (await purchaseDocRef.get()).data()
  if (!purchase || purchase.amount < params.body.amount) {
    throw throwInvalidArgument(WenError.invalid_params)
  }
  const token = <Token | undefined>(await admin.firestore().doc(`${COL.TOKENS}/${params.body.token}`).get()).data()
  if (!token || !tokenInSaleOrCoolDownPeriod(token)) {
    throw throwInvalidArgument(WenError.no_token_public_sale)
  }
  const space = <Space | undefined>(await admin.firestore().doc(`${COL.SPACE}/${token.space}`).get()).data()
  const member = <Member | undefined>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()

  const batch = admin.firestore().batch();
  if (purchase?.amount === params.body.amount) {
    batch.delete(purchaseDocRef)
  } else {
    batch.update(purchaseDocRef, { totalAmount: admin.firestore.FieldValue.increment(-params.body.amount) })
  }

  const tranId = getRandomEthAddress();
  const creditTranDoc = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
  const creditTransaction = <Transaction>{
    type: TransactionType.CREDIT,
    uid: tranId,
    space: token.space,
    member: owner,
    createdOn: serverTime(),
    payload: {
      amount: params.body.amount,
      sourceAddress: space?.validatedAddress,
      targetAddress: member?.validatedAddress,
      token: token.uid,
      reconciled: true,
      void: false,
    }
  };
  batch.set(creditTranDoc, creditTransaction)
  await batch.commit()

  return <Transaction>(await creditTranDoc.get()).data()
});
