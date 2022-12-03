import { HexHelper } from '@iota/util.js-next';
import {
  COL,
  MAX_MILLISECONDS,
  MAX_TOTAL_TOKEN_SUPPLY,
  MAX_WEEKS_TO_STAKE,
  MIN_WEEKS_TO_STAKE,
  StakeReward,
  StakeRewardStatus,
  StakeType,
  Token,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { CommonJoi } from '../services/joi/common';
import { SmrWallet } from '../services/wallet/SmrWalletService';
import { WalletService } from '../services/wallet/wallet';
import { packBasicOutput } from '../utils/basic-output.utils';
import { cOn, dateToTimestamp, serverTime } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertValidationAsync } from '../utils/schema.utils';
import { assertIsGuardian } from '../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';

const depositStakeSchema = {
  token: CommonJoi.uid(),
  weeks: Joi.number().integer().min(MIN_WEEKS_TO_STAKE).max(MAX_WEEKS_TO_STAKE).required(),
  type: Joi.string()
    .equal(...Object.values(StakeType))
    .required(),
  customMetadata: Joi.object()
    .max(5)
    .pattern(Joi.string().max(50), Joi.string().max(255))
    .optional(),
};

export const depositStake = functions
  .runWith({
    minInstances: scale(WEN_FUNC.depositStake),
  })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.tradeToken, context);
    const params = await decodeAuth(req, WEN_FUNC.tradeToken);
    const owner = params.address.toLowerCase();
    const schema = Joi.object(depositStakeSchema);
    await assertValidationAsync(schema, params.body);

    const token = <Token | undefined>(
      (await admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`).get()).data()
    );

    if (!token?.mintingData?.tokenId) {
      throw throwInvalidArgument(WenError.token_not_minted);
    }

    if (!token.approved || token.rejected) {
      throw throwInvalidArgument(WenError.token_not_approved);
    }

    const network = token.mintingData?.network!;
    const wallet = (await WalletService.newWallet(network)) as SmrWallet;
    const targetAddress = await wallet.getNewIotaAddressDetails();
    const nativeTokens = [
      {
        id: token.mintingData.tokenId,
        amount: HexHelper.fromBigInt256(bigInt(Number.MAX_SAFE_INTEGER)),
      },
    ];
    const output = packBasicOutput(
      targetAddress.bech32,
      0,
      nativeTokens,
      wallet.info,
      '',
      dateToTimestamp(dayjs().add(params.body.weeks, 'weeks').toDate()),
      undefined,
      params.body.customMetadata,
    );
    const order = <Transaction>{
      type: TransactionType.ORDER,
      uid: getRandomEthAddress(),
      member: owner,
      space: token.space,
      createdOn: serverTime(),
      network,
      payload: {
        type: TransactionOrderType.STAKE,
        amount: Number(output.amount),
        targetAddress: targetAddress.bech32,
        expiresOn: dateToTimestamp(
          dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
        ),
        validationType: TransactionValidationType.ADDRESS,
        reconciled: false,
        void: false,
        weeks: params.body.weeks,
        token: token.uid,
        tokenId: token.mintingData?.tokenId,
        stakeType: params.body.type,
        customMetadata: params.body.customMetadata || {},
      },
    };
    await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
    return order;
  });

interface StakeRewardItem {
  readonly startDate: number;
  readonly endDate: number;
  readonly tokenVestingDate: number;
  readonly tokensToDistribute: number;
}

const stakeRewardSchema = {
  token: CommonJoi.uid(),
  items: Joi.array()
    .min(1)
    .max(500)
    .items(
      Joi.object({
        startDate: Joi.number().min(0).max(MAX_MILLISECONDS).integer().required(),
        endDate: Joi.number()
          .min(0)
          .max(MAX_MILLISECONDS)
          .greater(Joi.ref('startDate'))
          .integer()
          .required(),
        tokenVestingDate: Joi.number()
          .min(0)
          .max(MAX_MILLISECONDS)
          .greater(Joi.ref('endDate'))
          .integer()
          .required(),
        tokensToDistribute: Joi.number().min(1).max(MAX_TOTAL_TOKEN_SUPPLY).required(),
      }),
    ),
};

export const stakeReward = functions
  .runWith({
    minInstances: scale(WEN_FUNC.stakeReward),
  })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.stakeReward, context);
    const params = await decodeAuth(req, WEN_FUNC.stakeReward);
    const owner = params.address.toLowerCase();
    const schema = Joi.object(stakeRewardSchema);
    await assertValidationAsync(schema, params.body);

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${params.body.token}`);
    const token = <Token | undefined>(await tokenDocRef.get()).data();
    if (!token) {
      throw throwInvalidArgument(WenError.token_does_not_exist);
    }
    await assertIsGuardian(token.space, owner);

    const stakeRewards = (params.body.items as StakeRewardItem[]).map<StakeReward>((item) => ({
      uid: getRandomEthAddress(),
      startDate: dateToTimestamp(dayjs(item.startDate).toDate()),
      endDate: dateToTimestamp(dayjs(item.endDate).toDate()),
      tokenVestingDate: dateToTimestamp(dayjs(item.tokenVestingDate).toDate()),
      tokensToDistribute: item.tokensToDistribute,
      token: params.body.token,
      status: StakeRewardStatus.UNPROCESSED,
      leftCheck: dayjs(item.startDate).valueOf(),
      rightCheck: dayjs(item.endDate).valueOf(),
    }));

    const batch = admin.firestore().batch();
    stakeRewards.forEach((stakeReward) => {
      const docRef = admin.firestore().doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`);
      batch.create(docRef, cOn(stakeReward));
    });
    await batch.commit();

    return stakeRewards;
  });
