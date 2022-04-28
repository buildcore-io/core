import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi from "joi";
import { merge } from 'lodash';
import { MAX_IOTA_AMOUNT, MAX_TOTAL_TOKEN_SUPLY, MIN_IOTA_AMOUNT, MIN_TOKEN_START_DATE_DAY, MIN_TOTAL_TOKEN_SUPLY, URL_PATHS } from '../../interfaces/config';
import { WenError } from '../../interfaces/errors';
import { WEN_FUNC } from '../../interfaces/functions';
import { TRANSACTION_AUTO_EXPIRY_MS, TRANSACTION_MAX_EXPIRY_MS } from '../../interfaces/models';
import { COL, SUB_COL, WenRequest } from '../../interfaces/models/base';
import { scale } from "../scale.settings";
import { cOn, dateToTimestamp, uOn } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from "../utils/google.utils";
import { keywords } from '../utils/keywords.utils';
import { assertValidation } from '../utils/schema.utils';
import { cleanParams, decodeAuth, getRandomEthAddress } from "../utils/wallet.utils";
import { Token, TokenAllocation } from './../../interfaces/models/token';

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
    percentage: Joi.number().min(0.01).precision(2).required(),
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
  params.body.startDate = dateToTimestamp(params.body.startDate)
  const data = keywords(cOn(merge(cleanParams(params.body), { uid: tokenUid, createdBy: owner, pending: true }), URL_PATHS.TOKEN))
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
