import { HexHelper } from '@iota/util.js-next';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import {
  MAX_WEEKS_TO_STAKE,
  MIN_WEEKS_TO_STAKE,
  PROD_AVAILABLE_MINTABLE_NETWORKS,
  TEST_AVAILABLE_MINTABLE_NETWORKS,
} from '../../interfaces/config';
import { WenError } from '../../interfaces/errors';
import { WEN_FUNC } from '../../interfaces/functions';
import {
  Space,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
} from '../../interfaces/models';
import { COL, WenRequest } from '../../interfaces/models/base';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { CommonJoi } from '../services/joi/common';
import { SmrWallet } from '../services/wallet/SmrWalletService';
import { WalletService } from '../services/wallet/wallet';
import { packBasicOutput } from '../utils/basic-output.utils';
import { getStakeTokenId, isProdEnv } from '../utils/config.utils';
import { dateToTimestamp, serverTime } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertValidation } from '../utils/schema.utils';
import { decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';

const networks = isProdEnv() ? PROD_AVAILABLE_MINTABLE_NETWORKS : TEST_AVAILABLE_MINTABLE_NETWORKS;
export const depositStake = functions
  .runWith({
    minInstances: scale(WEN_FUNC.depositStake),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.tradeToken, context);
    const params = await decodeAuth(req);
    const owner = params.address.toLowerCase();
    const schema = Joi.object({
      space: CommonJoi.uid,
      network: Joi.string()
        .equal(...networks)
        .required(),
      weeks: Joi.number().integer().min(MIN_WEEKS_TO_STAKE).max(MAX_WEEKS_TO_STAKE).required(),
    });
    assertValidation(schema.validate(params.body));

    const space = <Space | undefined>(
      (await admin.firestore().doc(`${COL.SPACE}/${params.body.space}`).get()).data()
    );
    if (!space) {
      throw throwInvalidArgument(WenError.space_does_not_exists);
    }
    const network = params.body.network;
    const wallet = (await WalletService.newWallet(network)) as SmrWallet;
    const targetAddress = await wallet.getNewIotaAddressDetails();
    const output = packBasicOutput(
      targetAddress.bech32,
      0,
      [{ id: getStakeTokenId(), amount: HexHelper.fromBigInt256(bigInt(Number.MAX_SAFE_INTEGER)) }],
      wallet.info,
      '',
      dateToTimestamp(dayjs().add(params.body.weeks).toDate()),
    );
    const order = <Transaction>{
      type: TransactionType.ORDER,
      uid: getRandomEthAddress(),
      member: owner,
      space: space.uid,
      createdOn: serverTime(),
      network: network,
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
      },
    };
    await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
    return order;
  });
