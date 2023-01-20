import {
  Access,
  COL,
  DEFAULT_NETWORK,
  MAX_IOTA_AMOUNT,
  MAX_TOTAL_TOKEN_SUPPLY,
  Member,
  MIN_IOTA_AMOUNT,
  MIN_TOKEN_START_DATE_DAY,
  MIN_TOTAL_TOKEN_SUPPLY,
  Space,
  SUB_COL,
  Timestamp,
  Token,
  TokenAllocation,
  TokenDistribution,
  TokenStatus,
  Transaction,
  TransactionCreditType,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  TRANSACTION_MAX_EXPIRY_MS,
  URL_PATHS,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { merge } from 'lodash';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { CommonJoi } from '../services/joi/common';
import { hasStakedSoonTokens } from '../services/stake.service';
import { assertHasAccess } from '../services/validators/access';
import { WalletService } from '../services/wallet/wallet';
import {
  assertMemberHasValidAddress,
  assertSpaceHasValidAddress,
  getAddress,
} from '../utils/address.utils';
import { isProdEnv } from '../utils/config.utils';
import { cOn, dateToTimestamp, uOn } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertIpNotBlocked } from '../utils/ip.utils';
import { assertValidationAsync } from '../utils/schema.utils';
import {
  allPaymentsQuery,
  assertIsGuardian,
  assertTokenApproved,
  assertTokenStatus,
  getBoughtByMemberDiff,
  memberDocRef,
  orderDocRef,
  tokenIsInCoolDownPeriod,
  tokenIsInPublicSalePeriod,
  tokenOrderTransactionDocId,
} from '../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';

const createSchema = () => ({
  name: Joi.string().required(),
  symbol: CommonJoi.tokenSymbol(),
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  shortDescriptionTitle: Joi.string().optional(),
  shortDescription: Joi.string().optional(),
  space: CommonJoi.uid(),
  pricePerToken: Joi.number().min(0.001).max(MAX_IOTA_AMOUNT).precision(3).optional(),
  totalSupply: Joi.number()
    .required()
    .min(MIN_TOTAL_TOKEN_SUPPLY)
    .max(MAX_TOTAL_TOKEN_SUPPLY)
    .integer()
    .unsafe(),
  allocations: Joi.array()
    .required()
    .items(
      Joi.object().keys({
        title: Joi.string().required(),
        percentage: Joi.number().min(0.01).max(100).precision(2).required(),
        isPublicSale: Joi.boolean().optional(),
      }),
    )
    .min(1)
    .custom((allocations: TokenAllocation[], helpers) => {
      const publicSaleCount = allocations.filter((a) => a.isPublicSale).length;
      if (publicSaleCount > 1) {
        return helpers.error('Only one public sale is allowed');
      }
      const total = allocations.reduce((acc, act) => acc + act.percentage, 0);
      if (total !== 100) {
        return helpers.error('Allocations percentage sum must be 100');
      }
      return allocations;
    }),
  // Only on prod we enforce 7 days.
  saleStartDate: Joi.date()
    .greater(
      dayjs()
        .add(isProdEnv() ? MIN_TOKEN_START_DATE_DAY : 0, 'd')
        .toDate(),
    )
    .optional(),
  saleLength: Joi.number()
    .min(TRANSACTION_AUTO_EXPIRY_MS)
    .max(TRANSACTION_MAX_EXPIRY_MS)
    .optional(),
  coolDownLength: Joi.number().min(0).max(TRANSACTION_MAX_EXPIRY_MS).optional(),
  autoProcessAt100Percent: Joi.boolean().optional(),
  links: Joi.array().min(0).items(Joi.string().uri()),
  icon: CommonJoi.storageUrl(),
  overviewGraphics: CommonJoi.storageUrl(),
  termsAndConditions: Joi.string().uri().required(),
  access: Joi.number()
    .equal(...Object.values(Access))
    .required(),
  accessAwards: Joi.when('access', {
    is: Joi.exist().valid(Access.MEMBERS_WITH_BADGE),
    then: Joi.array().items(CommonJoi.uid(false)).min(1).required(),
    otherwise: Joi.forbidden(),
  }),
  accessCollections: Joi.when('access', {
    is: Joi.exist().valid(Access.MEMBERS_WITH_NFT_FROM_COLLECTION),
    then: Joi.array().items(CommonJoi.uid(false)).min(1).required(),
    otherwise: Joi.forbidden(),
  }),
});

const getPublicSaleTimeFrames = (
  saleStartDate: Timestamp,
  saleLength: number,
  coolDownLength: number,
) => {
  const coolDownEnd = dayjs(saleStartDate.toDate()).add(saleLength + coolDownLength, 'ms');
  return { saleStartDate, saleLength, coolDownEnd: dateToTimestamp(coolDownEnd, true) };
};

// eslint-disable-next-line
const shouldSetPublicSaleTimeFrames = (body: any, allocations: TokenAllocation[]) => {
  const hasPublicSale = allocations.filter((a) => a.isPublicSale).length > 0;
  const count: number = [body.saleStartDate, body.saleLength, body.coolDownLength].reduce(
    (sum, act) => sum + (act === undefined ? 0 : 1),
    0,
  );
  if (count === 3 && !hasPublicSale) {
    throw throwInvalidArgument(WenError.no_token_public_sale);
  }
  if (count > 0 && count < 3) {
    throw throwInvalidArgument(WenError.invalid_params);
  }
  return count === 3;
};

export const createToken = functions
  .runWith({
    minInstances: scale(WEN_FUNC.cToken),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.cToken, context);
    const params = await decodeAuth(req, WEN_FUNC.cToken);
    const owner = params.address.toLowerCase();

    const schema = Joi.object(createSchema());
    await assertValidationAsync(schema, params.body);

    const hasStakedSoons = await hasStakedSoonTokens(owner);
    if (!hasStakedSoons) {
      throw throwInvalidArgument(WenError.no_staked_soon);
    }

    const snapshot = await admin
      .firestore()
      .collection(COL.TOKEN)
      .where('space', '==', params.body.space)
      .get();
    const nonOrAllRejected = snapshot.docs.reduce(
      (sum, doc) => sum && !doc.data()?.approve && doc.data()?.rejected,
      true,
    );
    if (!nonOrAllRejected) {
      throw throwInvalidArgument(WenError.token_already_exists_for_space);
    }

    const symbolSnapshot = await admin
      .firestore()
      .collection(COL.TOKEN)
      .where('symbol', '==', params.body.symbol)
      .where('rejected', '==', false)
      .get();
    if (symbolSnapshot.size > 0) {
      throw throwInvalidArgument(WenError.token_symbol_must_be_globally_unique);
    }

    await assertIsGuardian(params.body.space, owner);

    const space = <Space | undefined>(
      (await admin.firestore().doc(`${COL.SPACE}/${params.body.space}`).get()).data()
    );
    assertSpaceHasValidAddress(space, DEFAULT_NETWORK);

    const publicSaleTimeFrames = shouldSetPublicSaleTimeFrames(params.body, params.body.allocations)
      ? getPublicSaleTimeFrames(
          dateToTimestamp(params.body.saleStartDate, true),
          params.body.saleLength,
          params.body.coolDownLength,
        )
      : {};

    const tokenUid = getRandomEthAddress();
    const extraData = {
      uid: tokenUid,
      createdBy: owner,
      approved: !isProdEnv(),
      rejected: false,
      public: !isProdEnv(),
      status: TokenStatus.AVAILABLE,
      ipfsMedia: null,
      ipfsMetadata: null,
      totalDeposit: 0,
      totalAirdropped: 0,
    };
    const data = cOn(merge(params.body, publicSaleTimeFrames, extraData), URL_PATHS.TOKEN);
    await admin.firestore().collection(COL.TOKEN).doc(tokenUid).set(cOn(data));
    return <Token>(await admin.firestore().doc(`${COL.TOKEN}/${tokenUid}`).get()).data();
  });

const updateSchema = {
  name: Joi.string().required().allow(null, ''),
  title: Joi.string().required().allow(null, ''),
  description: Joi.string().required().allow(null, ''),
  shortDescriptionTitle: Joi.string().required().allow(null, ''),
  shortDescription: Joi.string().required().allow(null, ''),
  links: Joi.array().min(0).items(Joi.string().uri()),
  uid: CommonJoi.uid(),
  pricePerToken: Joi.number().min(0.001).max(MAX_IOTA_AMOUNT).precision(3).optional(),
};

export const updateToken = functions
  .runWith({
    minInstances: scale(WEN_FUNC.uToken),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.uToken, context);
    const params = await decodeAuth(req, WEN_FUNC.uToken);
    const owner = params.address.toLowerCase();

    const schema = Joi.object(updateSchema);
    await assertValidationAsync(schema, params.body);

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.uid}`);
    await admin.firestore().runTransaction(async (transaction) => {
      const token = <Token | undefined>(await transaction.get(tokenDocRef)).data();

      if (!token) {
        throw throwInvalidArgument(WenError.invalid_params);
      }
      assertTokenStatus(token, [TokenStatus.AVAILABLE]);
      await assertIsGuardian(token.space, owner);

      transaction.update(tokenDocRef, uOn(params.body));
    });

    return <Token>(await tokenDocRef.get()).data();
  });

const setAvailableForSaleSchema = {
  token: CommonJoi.uid(),
  saleStartDate: Joi.date()
    .greater(
      dayjs()
        .add(isProdEnv() ? MIN_TOKEN_START_DATE_DAY : 0, 'd')
        .toDate(),
    )
    .required(),
  saleLength: Joi.number()
    .min(TRANSACTION_AUTO_EXPIRY_MS)
    .max(TRANSACTION_MAX_EXPIRY_MS)
    .required(),
  coolDownLength: Joi.number().min(0).max(TRANSACTION_MAX_EXPIRY_MS).required(),
  autoProcessAt100Percent: Joi.boolean().optional(),
  pricePerToken: Joi.number().min(0.001).max(MAX_IOTA_AMOUNT).precision(3).required(),
};

export const setTokenAvailableForSale = functions
  .runWith({
    minInstances: scale(WEN_FUNC.setTokenAvailableForSale),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.setTokenAvailableForSale, context);
    const params = await decodeAuth(req, WEN_FUNC.setTokenAvailableForSale);
    const owner = params.address.toLowerCase();

    const schema = Joi.object(setAvailableForSaleSchema);
    await assertValidationAsync(schema, params.body);

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`);

    await admin.firestore().runTransaction(async (transaction) => {
      const token = <Token | undefined>(await transaction.get(tokenDocRef)).data();
      if (!token) {
        throw throwInvalidArgument(WenError.invalid_params);
      }

      assertTokenApproved(token);

      if (token.saleStartDate) {
        throw throwInvalidArgument(WenError.public_sale_already_set);
      }

      assertTokenStatus(token, [TokenStatus.AVAILABLE]);

      await assertIsGuardian(token.space, owner);

      shouldSetPublicSaleTimeFrames(params.body, token.allocations);
      const timeFrames = getPublicSaleTimeFrames(
        dateToTimestamp(params.body.saleStartDate, true),
        params.body.saleLength,
        params.body.coolDownLength,
      );
      transaction.update(
        tokenDocRef,
        uOn({
          ...timeFrames,
          autoProcessAt100Percent: params.body.autoProcessAt100Percent || false,
          pricePerToken: Number(params.body.pricePerToken),
        }),
      );
    });

    return <Token>(await tokenDocRef.get()).data();
  });

export const cancelPublicSale = functions
  .runWith({
    minInstances: scale(WEN_FUNC.cancelPublicSale),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.cancelPublicSale, context);
    const params = await decodeAuth(req, WEN_FUNC.cancelPublicSale);
    const owner = params.address.toLowerCase();

    const schema = Joi.object({ token: CommonJoi.uid() });
    await assertValidationAsync(schema, params.body);

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`);

    await admin.firestore().runTransaction(async (transaction) => {
      const token = <Token | undefined>(await transaction.get(tokenDocRef)).data();

      if (!token) {
        throw throwInvalidArgument(WenError.invalid_params);
      }

      if (!token.coolDownEnd || dayjs().add(30, 's').isAfter(dayjs(token.coolDownEnd.toDate()))) {
        throw throwInvalidArgument(WenError.no_token_public_sale);
      }

      await assertIsGuardian(token.space, owner);

      transaction.update(
        tokenDocRef,
        uOn({
          saleStartDate: admin.firestore.FieldValue.delete(),
          saleLength: admin.firestore.FieldValue.delete(),
          coolDownEnd: admin.firestore.FieldValue.delete(),
          status: TokenStatus.CANCEL_SALE,
          totalDeposit: 0,
        }),
      );
    });

    return <Token>(await tokenDocRef.get()).data();
  });

const orderTokenSchema = Joi.object({ token: CommonJoi.uid() });

export const orderToken = functions
  .runWith({
    minInstances: scale(WEN_FUNC.orderToken),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.orderToken, context);
    const params = await decodeAuth(req, WEN_FUNC.orderToken);
    const owner = params.address.toLowerCase();
    await assertValidationAsync(orderTokenSchema, params.body);

    const member = <Member | undefined>(
      (await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data()
    );
    assertMemberHasValidAddress(member, DEFAULT_NETWORK);

    const tokenDoc = await admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`).get();
    if (!tokenDoc.exists) {
      throw throwInvalidArgument(WenError.invalid_params);
    }

    if (isProdEnv()) {
      await assertIpNotBlocked(context.rawRequest?.ip || '', tokenDoc.id, 'token');
    }

    const token = <Token>tokenDoc.data();
    if (!tokenIsInPublicSalePeriod(token) || token.status !== TokenStatus.AVAILABLE) {
      throw throwInvalidArgument(WenError.no_token_public_sale);
    }

    const tranId = tokenOrderTransactionDocId(owner, token);
    const orderDoc = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
    const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${token.space}`).get()).data();

    await assertHasAccess(
      space.uid,
      owner,
      token.access,
      token.accessAwards || [],
      token.accessCollections || [],
    );

    const network = DEFAULT_NETWORK;
    const newWallet = await WalletService.newWallet(network);
    const targetAddress = await newWallet.getNewIotaAddressDetails();
    await admin.firestore().runTransaction(async (transaction) => {
      const order = await transaction.get(orderDoc);
      if (!order.exists) {
        const data = <Transaction>{
          type: TransactionType.ORDER,
          uid: tranId,
          member: owner,
          space: token.space,
          network,
          payload: {
            type: TransactionOrderType.TOKEN_PURCHASE,
            amount: token.pricePerToken,
            targetAddress: targetAddress.bech32,
            beneficiary: 'space',
            beneficiaryUid: token.space,
            beneficiaryAddress: getAddress(space, network),
            expiresOn: dateToTimestamp(
              dayjs(token.saleStartDate?.toDate()).add(token.saleLength || 0, 'ms'),
            ),
            validationType: TransactionValidationType.ADDRESS,
            reconciled: false,
            void: false,
            chainReference: null,
            token: token.uid,
          },
          linkedTransactions: [],
        };
        transaction.set(orderDoc, cOn(data));
      }
    });

    return <Transaction>(await orderDoc.get()).data();
  });

const creditTokenSchema = {
  token: CommonJoi.uid(),
  amount: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required(),
};

export const creditToken = functions
  .runWith({
    minInstances: scale(WEN_FUNC.creditToken),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.creditToken, context);
    const params = await decodeAuth(req, WEN_FUNC.creditToken);
    const owner = params.address.toLowerCase();
    const schema = Joi.object(creditTokenSchema);
    await assertValidationAsync(schema, params.body);

    const tranId = getRandomEthAddress();
    const creditTranDoc = admin.firestore().collection(COL.TRANSACTION).doc(tranId);

    await admin.firestore().runTransaction(async (transaction) => {
      const distributionDocRef = admin
        .firestore()
        .doc(`${COL.TOKEN}/${params.body.token}/${SUB_COL.DISTRIBUTION}/${owner}`);
      const distribution = <TokenDistribution | undefined>(
        (await transaction.get(distributionDocRef)).data()
      );
      if (!distribution || (distribution.totalDeposit || 0) < params.body.amount) {
        throw throwInvalidArgument(WenError.not_enough_funds);
      }
      const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`);
      const token = <Token | undefined>(await tokenDocRef.get()).data();
      if (!token || !tokenIsInCoolDownPeriod(token) || token.status !== TokenStatus.AVAILABLE) {
        throw throwInvalidArgument(WenError.token_not_in_cool_down_period);
      }
      const member = <Member>(await memberDocRef(owner).get()).data();
      const order = <Transaction>(await transaction.get(orderDocRef(owner, token))).data();
      const payments = (await transaction.get(allPaymentsQuery(owner, token.uid))).docs.map(
        (d) => <Transaction>d.data(),
      );

      const totalDepositLeft = (distribution.totalDeposit || 0) - params.body.amount;
      const refundAmount =
        params.body.amount + (totalDepositLeft < MIN_IOTA_AMOUNT ? totalDepositLeft : 0);

      const boughtByMemberDiff = getBoughtByMemberDiff(
        distribution.totalDeposit || 0,
        totalDepositLeft || 0,
        token.pricePerToken,
      );
      transaction.update(
        distributionDocRef,
        uOn({
          totalDeposit: admin.firestore.FieldValue.increment(-refundAmount),
        }),
      );
      transaction.update(
        tokenDocRef,
        uOn({
          totalDeposit: admin.firestore.FieldValue.increment(-refundAmount),
          tokensOrdered: admin.firestore.FieldValue.increment(boughtByMemberDiff),
        }),
      );

      const creditTransaction = <Transaction>{
        type: TransactionType.CREDIT,
        uid: tranId,
        space: token.space,
        member: member.uid,
        network: order.network || DEFAULT_NETWORK,
        payload: {
          type: TransactionCreditType.TOKEN_PURCHASE,
          amount: refundAmount,
          sourceAddress: order.payload.targetAddress,
          targetAddress: getAddress(member, order.network || DEFAULT_NETWORK),
          sourceTransaction: payments.map((d) => d.uid),
          token: token.uid,
          reconciled: true,
          void: false,
        },
      };
      transaction.set(creditTranDoc, cOn(creditTransaction));
    });

    return <Transaction>(await creditTranDoc.get()).data();
  });
