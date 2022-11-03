import { HexHelper } from '@iota/util.js-next';
import {
  COL,
  MAX_WEEKS_TO_STAKE,
  MIN_WEEKS_TO_STAKE,
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
import { dateToTimestamp, serverTime } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertValidation } from '../utils/schema.utils';
import { decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';

const schema = Joi.object({
  token: CommonJoi.uid(),
  weeks: Joi.number().integer().min(MIN_WEEKS_TO_STAKE).max(MAX_WEEKS_TO_STAKE).required(),
  type: Joi.string()
    .equal(...Object.values(StakeType))
    .required(),
  customMetadata: Joi.object()
    .max(5)
    .pattern(Joi.string().max(50), Joi.string().max(255))
    .optional(),
});

export const depositStake = functions
  .runWith({
    minInstances: scale(WEN_FUNC.depositStake),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.tradeToken, context);
    const params = await decodeAuth(req);
    const owner = params.address.toLowerCase();
    assertValidation(schema.validate(params.body));

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
      dateToTimestamp(dayjs().add(params.body.weeks).toDate()),
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
