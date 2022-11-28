import {
  COL,
  DEFAULT_NETWORK,
  MAX_TOTAL_TOKEN_SUPPLY,
  Space,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenDrop,
  TokenStatus,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { isEmpty } from 'lodash';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { CommonJoi } from '../services/joi/common';
import { WalletService } from '../services/wallet/wallet';
import { getAddress } from '../utils/address.utils';
import { generateRandomAmount } from '../utils/common.utils';
import { cOn, dateToTimestamp, serverTime, uOn } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertValidationAsync } from '../utils/schema.utils';
import { assertIsGuardian, assertTokenApproved, assertTokenStatus } from '../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';

export const airdropTokenSchema = {
  token: CommonJoi.uid(),
  drops: Joi.array()
    .required()
    .items(
      Joi.object().keys({
        vestingAt: Joi.date().required(),
        count: Joi.number().min(1).max(MAX_TOTAL_TOKEN_SUPPLY).integer().required(),
        recipient: CommonJoi.uid().required(),
      }),
    )
    .min(1)
    .max(400),
};

const hasAvailableTokenToAirdrop = (token: Token, count: number) => {
  const publicPercentage = token.allocations.find((a) => a.isPublicSale)?.percentage || 0;
  const totalPublicSupply = Math.floor(token.totalSupply * (publicPercentage / 100));
  return token.totalSupply - totalPublicSupply - token.totalAirdropped >= count;
};

export const airdropToken = functions
  .runWith({ minInstances: scale(WEN_FUNC.airdropToken) })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.airdropToken, context);
    const params = await decodeAuth(req, WEN_FUNC.airdropToken);
    const owner = params.address.toLowerCase();
    const schema = Joi.object(airdropTokenSchema);
    await assertValidationAsync(schema, params.body);

    const distributionDocRefs: admin.firestore.DocumentReference<admin.firestore.DocumentData>[] =
      params.body.drops.map(({ recipient }: { recipient: string }) =>
        admin
          .firestore()
          .doc(
            `${COL.TOKEN}/${params.body.token}/${SUB_COL.DISTRIBUTION}/${recipient.toLowerCase()}`,
          ),
      );

    await admin.firestore().runTransaction(async (transaction) => {
      const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`);
      const token = <Token | undefined>(await transaction.get(tokenDocRef)).data();

      if (!token) {
        throw throwInvalidArgument(WenError.invalid_params);
      }

      assertTokenApproved(token);
      assertTokenStatus(token, [TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED]);

      await assertIsGuardian(token.space, owner);

      const totalDropped = params.body.drops.reduce(
        (sum: number, { count }: { count: number }) => sum + count,
        0,
      );
      if (!hasAvailableTokenToAirdrop(token, totalDropped)) {
        throw throwInvalidArgument(WenError.no_tokens_available_for_airdrop);
      }

      transaction.update(
        tokenDocRef,
        uOn({
          totalAirdropped: admin.firestore.FieldValue.increment(totalDropped),
        }),
      );

      for (let i = 0; i < params.body.drops.length; ++i) {
        const drop = params.body.drops[i];
        const airdropData = {
          parentId: token.uid,
          parentCol: COL.TOKEN,
          uid: drop.recipient.toLowerCase(),
          tokenDrops: admin.firestore.FieldValue.arrayUnion(<TokenDrop>{
            createdOn: dateToTimestamp(dayjs()),
            vestingAt: dateToTimestamp(drop.vestingAt),
            count: drop.count,
            uid: getRandomEthAddress(),
          }),
        };
        transaction.set(distributionDocRefs[i], uOn(airdropData), { merge: true });
      }
    });

    const promises = distributionDocRefs.map((docRef) => docRef.get());
    return <TokenDistribution[]>(await Promise.all(promises)).map((d) => d.data());
  });

export const claimAirdroppedToken = functions
  .runWith({ minInstances: scale(WEN_FUNC.claimAirdroppedToken) })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.claimAirdroppedToken, context);
    const params = await decodeAuth(req, WEN_FUNC.claimAirdroppedToken);
    const owner = params.address.toLowerCase();

    const schema = Joi.object({ token: Joi.string().required() });
    await assertValidationAsync(schema, params.body);

    const token = <Token | undefined>(
      (await admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`).get()).data()
    );
    if (!token) {
      throw throwInvalidArgument(WenError.invalid_params);
    }

    assertTokenStatus(token, [TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED]);

    const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${token.space}`).get()).data();

    const tranId = getRandomEthAddress();
    const orderDocRef = admin.firestore().collection(COL.TRANSACTION).doc(tranId);

    const wallet = await WalletService.newWallet();
    const targetAddress = await wallet.getNewIotaAddressDetails();

    await admin.firestore().runTransaction(async (transaction) => {
      const distributionDocRef = admin
        .firestore()
        .doc(`${COL.TOKEN}/${params.body.token}/${SUB_COL.DISTRIBUTION}/${owner}`);
      const distribution = <TokenDistribution>(await transaction.get(distributionDocRef)).data();

      if (!distribution) {
        throw throwInvalidArgument(WenError.invalid_params);
      }

      const claimableDrops =
        distribution.tokenDrops?.filter((d) => dayjs(d.vestingAt.toDate()).isBefore(dayjs())) || [];
      const dropCount = claimableDrops.reduce((sum, act) => sum + act.count, 0);

      if (isEmpty(claimableDrops)) {
        throw throwInvalidArgument(WenError.no_airdrop_to_claim);
      }

      const order = <Transaction>{
        type: TransactionType.ORDER,
        uid: tranId,
        member: owner,
        space: token.space,
        network: DEFAULT_NETWORK,
        payload: {
          type: TransactionOrderType.TOKEN_AIRDROP,
          amount: generateRandomAmount(),
          targetAddress: targetAddress.bech32,
          beneficiary: 'space',
          beneficiaryUid: token.space,
          beneficiaryAddress: getAddress(space, DEFAULT_NETWORK),
          expiresOn: dateToTimestamp(
            dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
          ),
          validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
          reconciled: false,
          void: false,
          token: token.uid,
          quantity: dropCount,
        },
      };
      transaction.create(orderDocRef, cOn(order));
    });

    return <Transaction>(await orderDocRef.get()).data();
  });
