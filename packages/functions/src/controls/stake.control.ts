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
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { CommonJoi } from '../services/joi/common';
import { createStakeOrder } from '../services/payment/tangle-service/stake.service';
import { cOn, dateToTimestamp } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertValidationAsync } from '../utils/schema.utils';
import { assertIsGuardian } from '../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';

export const depositStakeSchema = {
  symbol: CommonJoi.tokenSymbol(),
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

    const order = await createStakeOrder(
      owner,
      params.body.symbol,
      params.body.weeks,
      params.body.type,
      params.body.customMetadata,
    );
    await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
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
