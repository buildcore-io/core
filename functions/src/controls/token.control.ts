import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from "joi";
import { merge } from 'lodash';
import { MAX_IOTA_AMOUNT, MAX_TOTAL_TOKEN_SUPPLY, MIN_IOTA_AMOUNT, MIN_TOKEN_START_DATE_DAY, MIN_TOTAL_TOKEN_SUPPLY, URL_PATHS } from '../../interfaces/config';
import { WenError } from '../../interfaces/errors';
import { WEN_FUNC } from '../../interfaces/functions';
import { Member, Transaction, TransactionCreditType, TransactionOrderType, TransactionType, TransactionValidationType, TRANSACTION_AUTO_EXPIRY_MS, TRANSACTION_MAX_EXPIRY_MS } from '../../interfaces/models';
import { COL, SUB_COL, Timestamp, WenRequest } from '../../interfaces/models/base';
import admin from '../admin.config';
import { scale } from "../scale.settings";
import { WalletService } from '../services/wallet/wallet';
import { isProdEnv } from '../utils/config.utils';
import { cOn, dateToTimestamp, serverTime, uOn } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from "../utils/google.utils";
import { keywords } from '../utils/keywords.utils';
import { assertValidation } from '../utils/schema.utils';
import { allPaymentsQuery, assertIsGuardian, memberDocRef, orderDocRef, tokenOrderTransactionDocId } from '../utils/token.utils';
import { cleanParams, decodeAuth, getRandomEthAddress } from "../utils/wallet.utils";
import { Token, TokenAllocation, TokenDistribution, TokenStatus } from './../../interfaces/models/token';

const createSchema = () => ({
  name: Joi.string().required(),
  symbol: Joi.string().required().length(4).regex(RegExp('^[A-Z]+$')),
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  space: Joi.string().required(),
  pricePerToken: Joi.number().min(1).max(MAX_IOTA_AMOUNT).required(),
  totalSupply: Joi.number().required().min(MIN_TOTAL_TOKEN_SUPPLY).max(MAX_TOTAL_TOKEN_SUPPLY).integer(),
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
  // Only on prod we enforce 7 days.
  saleStartDate: Joi.date().greater(dayjs().add(isProdEnv ? MIN_TOKEN_START_DATE_DAY : 0, 'd').toDate()).optional(),
  saleLength: Joi.number().min(TRANSACTION_AUTO_EXPIRY_MS).max(TRANSACTION_MAX_EXPIRY_MS).optional(),
  coolDownLength: Joi.number().min(TRANSACTION_AUTO_EXPIRY_MS).max(TRANSACTION_MAX_EXPIRY_MS).optional(),
  links: Joi.array().min(0).items(Joi.string().uri()),
  icon: Joi.string().required(),
  overviewGraphics: Joi.string().required(),
  termsAndConditions: Joi.string().uri().required()
})

const getPublicSaleTimeFrames = (saleStartDate: Timestamp, saleLength: number, coolDownLength: number) => {
  const coolDownEnd = dayjs(saleStartDate.toDate()).add(saleLength + coolDownLength, 'ms')
  return { saleStartDate, saleLength, coolDownEnd: dateToTimestamp(coolDownEnd) }
}

// eslint-disable-next-line
const shouldSetPublicSaleTimeFrames = (body: any, allocations: TokenAllocation[]) => {
  const hasPublicSale = allocations.filter(a => a.isPublicSale).length > 0
  const count: number = [body.saleStartDate, body.saleLength, body.coolDownLength].reduce((sum, act) => sum + (act === undefined ? 0 : 1), 0)
  if (count === 3 && !hasPublicSale) {
    throw throwInvalidArgument(WenError.no_token_public_sale);
  }
  if (count > 0 && count < 3) {
    throw throwInvalidArgument(WenError.invalid_params);
  }
  return count === 3
}

export const createToken = functions.runWith({
  minInstances: scale(WEN_FUNC.cToken),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.cSpace, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();

  const schema = Joi.object(createSchema());
  assertValidation(schema.validate(params.body));

  const snapshot = await admin.firestore().collection(COL.TOKEN).where('space', '==', params.body.space).get()
  if (snapshot.size > 0) {
    throw throwInvalidArgument(WenError.token_already_exists_for_space);
  }

  const symbolSnapshot = await admin.firestore().collection(COL.TOKEN).where('symbol', '==', params.body.symbol).get();
  if (symbolSnapshot.size > 0) {
    throw throwInvalidArgument(WenError.token_symbol_must_be_globally_unique);
  }

  await assertIsGuardian(params.body.space, owner)

  const publicSaleTimeFrames = shouldSetPublicSaleTimeFrames(params.body, params.body.allocations) ?
    getPublicSaleTimeFrames(dateToTimestamp(params.body.saleStartDate), params.body.saleLength, params.body.coolDownLength) : {}

  const tokenUid = getRandomEthAddress();
  const extraData = { uid: tokenUid, createdBy: owner, approved: false, rejected: false, status: TokenStatus.AVAILABLE, totalDeposit: 0, totalAirdropped: 0 }
  const data = keywords(cOn(merge(cleanParams(params.body), publicSaleTimeFrames, extraData), URL_PATHS.TOKEN))
  await admin.firestore().collection(COL.TOKEN).doc(tokenUid).set(data);
  return <Token>(await admin.firestore().doc(`${COL.TOKEN}/${tokenUid}`).get()).data()
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

  const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.uid}`);
  const data = (await tokenDocRef.get()).data()

  if (!data) {
    throw throwInvalidArgument(WenError.invalid_params)
  }

  await assertIsGuardian(data.space, owner)

  await tokenDocRef.update(uOn(params.body))
  return <Token>(await tokenDocRef.get()).data()
})

const setAvailableForSaleSchema = {
  token: Joi.string().required(),
  saleStartDate: Joi.date().greater(dayjs().add(isProdEnv ? MIN_TOKEN_START_DATE_DAY : 0, 'd').toDate()).required(),
  saleLength: Joi.number().min(TRANSACTION_AUTO_EXPIRY_MS).max(TRANSACTION_MAX_EXPIRY_MS).required(),
  coolDownLength: Joi.number().min(TRANSACTION_AUTO_EXPIRY_MS).max(TRANSACTION_MAX_EXPIRY_MS).required(),
}

export const setTokenAvailableForSale = functions.runWith({
  minInstances: scale(WEN_FUNC.setTokenAvailableForSale),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.cSpace, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();

  const schema = Joi.object(setAvailableForSaleSchema);
  assertValidation(schema.validate(params.body));

  const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`);

  await admin.firestore().runTransaction(async (transaction) => {
    const data = <Token | undefined>(await transaction.get(tokenDocRef)).data()
    if (!data) {
      throw throwInvalidArgument(WenError.invalid_params)
    }
    if (data.saleStartDate) {
      throw throwInvalidArgument(WenError.public_sale_already_set)
    }
    await assertIsGuardian(data.space, owner)
    shouldSetPublicSaleTimeFrames(params.body, data.allocations);
    const timeFrames = getPublicSaleTimeFrames(dateToTimestamp(params.body.saleStartDate), params.body.saleLength, params.body.coolDownLength);
    transaction.update(tokenDocRef, timeFrames);
  })

  return <Token>(await tokenDocRef.get()).data();
})


const tokenOrderIsWithinPublicSalePeriod = (token: Token) => token.saleStartDate && token.saleLength &&
  dayjs().isAfter(dayjs(token.saleStartDate?.toDate())) && dayjs().isBefore(dayjs(token.saleStartDate.toDate()).add(token.saleLength, 'ms'))


const tokenCoolDownPeriod = (token: Token) => token.saleStartDate && token.saleLength &&
  dayjs().isAfter(dayjs(token.saleStartDate.toDate()).add(token.saleLength, 'ms')) &&
  dayjs().isBefore(dayjs(token.saleStartDate.toDate()).add(token.saleLength, 'ms').add(2, 'd'))

export const orderToken = functions.runWith({
  minInstances: scale(WEN_FUNC.orderToken),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.orderToken, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema = Joi.object({ token: Joi.string().required() });
  assertValidation(schema.validate(params.body));

  const tokenDoc = await admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`).get()
  if (!tokenDoc.exists) {
    throw throwInvalidArgument(WenError.invalid_params)
  }
  const token = <Token>tokenDoc.data()
  if (!tokenOrderIsWithinPublicSalePeriod(token)) {
    throw throwInvalidArgument(WenError.no_token_public_sale)
  }

  const tranId = tokenOrderTransactionDocId(owner, token)
  const orderDoc = admin.firestore().collection(COL.TRANSACTION).doc(tranId)
  const space = (await admin.firestore().doc(`${COL.SPACE}/${token.space}`).get()).data()
  const newWallet = new WalletService();
  const targetAddress = await newWallet.getNewIotaAddressDetails();

  await admin.firestore().runTransaction(async (transaction) => {
    const order = await transaction.get(orderDoc)
    if (!order.exists) {
      const data = <Transaction>{
        type: TransactionType.ORDER,
        uid: tranId,
        member: owner,
        space: token.space,
        createdOn: serverTime(),
        payload: {
          type: TransactionOrderType.TOKEN_PURCHASE,
          amount: token.pricePerToken,
          targetAddress: targetAddress.bech32,
          beneficiary: 'space',
          beneficiaryUid: token.space,
          beneficiaryAddress: space?.validatedAddress,
          expiresOn: dateToTimestamp(dayjs(token.saleStartDate?.toDate()).add(token.saleLength || 0, 'ms')),
          validationType: TransactionValidationType.ADDRESS,
          reconciled: false,
          void: false,
          chainReference: null,
          token: token.uid
        },
        linkedTransactions: []
      }
      transaction.set(orderDoc, data)
    }
  })

  return <Transaction>(await orderDoc.get()).data()
});

const creditTokenSchema = ({
  token: Joi.string().required(),
  amount: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required()
})

export const creditToken = functions.runWith({
  minInstances: scale(WEN_FUNC.creditToken),
}).https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
  appCheck(WEN_FUNC.orderToken, context);
  const params = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema = Joi.object(creditTokenSchema);
  assertValidation(schema.validate(params.body));

  const tranId = getRandomEthAddress();
  const creditTranDoc = admin.firestore().collection(COL.TRANSACTION).doc(tranId);

  await admin.firestore().runTransaction(async (transaction) => {
    const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}/${SUB_COL.DISTRIBUTION}/${owner}`)
    const distribution = <TokenDistribution | undefined>(await transaction.get(distributionDocRef)).data()
    if (!distribution || distribution.totalDeposit < params.body.amount) {
      throw throwInvalidArgument(WenError.not_enough_funds)
    }
    const token = <Token | undefined>(await admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`).get()).data()
    if (!token || !tokenCoolDownPeriod(token)) {
      throw throwInvalidArgument(WenError.token_not_in_cool_down_period)
    }
    const member = <Member>(await memberDocRef(owner).get()).data()
    const order = await transaction.get(orderDocRef(owner, token))
    const payments = (await transaction.get(allPaymentsQuery(owner, token.uid))).docs.map(d => <Transaction>d.data())

    transaction.update(distributionDocRef, { totalDeposit: admin.firestore.FieldValue.increment(-params.body.amount) })
    const creditTransaction = <Transaction>{
      type: TransactionType.CREDIT,
      uid: tranId,
      space: token.space,
      member: member.uid,
      createdOn: serverTime(),
      payload: {
        type: TransactionCreditType.TOKEN_PURCHASE,
        amount: params.body.amount,
        sourceAddress: order.data()?.payload.targetAddress,
        targetAddress: member.validatedAddress,
        sourceTransaction: payments.map(d => d.uid),
        token: token.uid,
        reconciled: true,
        void: false
      }
    };
    transaction.set(creditTranDoc, creditTransaction)
  })

  return <Transaction>(await creditTranDoc.get()).data()
});

const airdropTokenSchema = ({
  token: Joi.string().required(),
  drops: Joi.array().required().items(Joi.object().keys({
    count: Joi.number().min(1).max(MAX_TOTAL_TOKEN_SUPPLY).integer().required(),
    recipient: Joi.string().required()
  })).min(1)
})

const hasAvailableTokenToAirdrop = (token: Token, count: number) => {
  const publicPercentage = token.allocations.find(a => a.isPublicSale)?.percentage || 0
  const totalPublicSupply = Math.floor(token.totalSupply * (publicPercentage / 100))
  return token.totalSupply - totalPublicSupply - token.totalAirdropped >= count
}

export const airdropToken = functions.runWith({ minInstances: scale(WEN_FUNC.airdropToken) })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.orderToken, context);
    const params = await decodeAuth(req);
    const owner = params.address.toLowerCase();
    const schema = Joi.object(airdropTokenSchema);
    assertValidation(schema.validate(params.body));

    const distributionDocRefs: admin.firestore.DocumentReference<admin.firestore.DocumentData>[] =
      params.body.drops.map(({ recipient }: { recipient: string }) =>
        admin.firestore().doc(`${COL.TOKEN}/${params.body.token}/${SUB_COL.DISTRIBUTION}/${recipient}`)
      );

    await admin.firestore().runTransaction(async (transaction) => {
      const distributionDocs = []
      for (const docRef of distributionDocRefs) {
        distributionDocs.push(await transaction.get(docRef))
      }

      const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`);
      const token = <Token>(await transaction.get(tokenDocRef)).data();

      if (!token) {
        throw throwInvalidArgument(WenError.invalid_params);
      }
      await assertIsGuardian(token.space, owner);

      const totalDropped = params.body.drops.reduce((sum: number, { count }: { count: number }) => sum + count, 0)
      if (!hasAvailableTokenToAirdrop(token, totalDropped)) {
        throw throwInvalidArgument(WenError.no_tokens_available_for_airdrop);
      }

      transaction.update(tokenDocRef, { totalAirdropped: admin.firestore.FieldValue.increment(totalDropped) })

      for (let i = 0; i < params.body.drops.length; ++i) {
        const drop = params.body.drops[i]
        const airdropData = {
          parentId: token.uid,
          parentCol: COL.TOKEN,
          member: drop.recipient,
          createdOn: serverTime(),
          tokenDropped: admin.firestore.FieldValue.increment(drop.count)
        }
        transaction.create(distributionDocRefs[i], airdropData);
      }
    })

    const promises = distributionDocRefs.map(docRef => docRef.get());
    return <TokenDistribution[]>(await Promise.all(promises)).map(d => d.data());
  });

export const claimAirdroppedToken = functions.runWith({ minInstances: scale(WEN_FUNC.claimAirdroppedToken) })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.orderToken, context);
    const params = await decodeAuth(req);
    const owner = params.address.toLowerCase();
    const schema = Joi.object({ token: Joi.string().required() });
    assertValidation(schema.validate(params.body));

    const tokenDoc = await admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`).get();
    if (!tokenDoc.exists) {
      throw throwInvalidArgument(WenError.invalid_params);
    }

    const spaceDoc = await admin.firestore().doc(`${COL.SPACE}/${tokenDoc.data()?.space}`).get()

    const tranId = getRandomEthAddress()
    const orderDoc = admin.firestore().collection(COL.TRANSACTION).doc(tranId)

    await admin.firestore().runTransaction(async (transaction) => {
      const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}/${SUB_COL.DISTRIBUTION}/${owner}`);
      const distribution = <TokenDistribution>(await transaction.get(distributionDocRef)).data();

      if (!distribution) {
        throw throwInvalidArgument(WenError.invalid_params)
      }

      if (distribution.tokenDropped == (distribution.tokenClaimed || 0)) {
        throw throwInvalidArgument(WenError.airdrop_already_claimed)
      }

      const newWallet = new WalletService();
      const targetAddress = await newWallet.getNewIotaAddressDetails();
      const orderData = <Transaction>{
        type: TransactionType.ORDER,
        uid: tranId,
        member: owner,
        space: tokenDoc.data()?.space,
        createdOn: serverTime(),
        payload: {
          type: TransactionOrderType.TOKEN_AIRDROP,
          amount: MIN_IOTA_AMOUNT,
          targetAddress: targetAddress.bech32,
          beneficiary: 'space',
          beneficiaryUid: tokenDoc.data()?.space,
          beneficiaryAddress: spaceDoc.data()?.validatedAddress,
          expiresOn: dateToTimestamp(dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms')),
          validationType: TransactionValidationType.ADDRESS,
          reconciled: false,
          void: false,
          chainReference: null,
          token: tokenDoc.id
        },
        linkedTransactions: []
      }
      transaction.create(orderDoc, orderData)
    })

    return <Transaction>(await (orderDoc.get())).data();
  });

