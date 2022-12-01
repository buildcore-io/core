import {
  COL,
  DEFAULT_NETWORK,
  Transaction,
  TransactionIgnoreWalletReason,
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
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { WalletService } from '../../services/wallet/wallet';
import { cOn, dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';

export const creditUnrefundable = functions
  .runWith({
    minInstances: scale(WEN_FUNC.creditUnrefundable),
  })
  .https.onCall(async (req: WenRequest, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.tradeToken, context);
    const params = await decodeAuth(req, WEN_FUNC.tradeToken);
    const owner = params.address.toLowerCase();
    const schema = Joi.object({ transaction: CommonJoi.uid() });
    await assertValidationAsync(schema, params.body);

    return await admin.firestore().runTransaction(async (transaction) => {
      const creditTtransactionDocRef = admin
        .firestore()
        .doc(`${COL.TRANSACTION}/${params.body.transaction}`);
      const creditTtransaction = <Transaction | undefined>(
        (await transaction.get(creditTtransactionDocRef)).data()
      );
      if (
        creditTtransaction?.ignoreWalletReason !==
        TransactionIgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION
      ) {
        throw throwInvalidArgument(WenError.can_not_credit_transaction);
      }
      if (creditTtransaction.payload.unlockedBy) {
        throw throwInvalidArgument(WenError.transaction_already_confirmed);
      }

      const wallet = await WalletService.newWallet(creditTtransaction.network);
      const targetAddress = await wallet.getNewIotaAddressDetails();
      const order = <Transaction>{
        type: TransactionType.ORDER,
        uid: getRandomEthAddress(),
        member: owner,
        space: creditTtransaction.space,
        network: creditTtransaction.network || DEFAULT_NETWORK,
        payload: {
          type: TransactionOrderType.CREDIT_LOCKED_FUNDS,
          amount: creditTtransaction.payload.amount,
          targetAddress: targetAddress.bech32,
          expiresOn: dateToTimestamp(
            dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
          ),
          validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
          reconciled: false,
          void: false,
          transaction: creditTtransaction.uid,
        },
      };
      await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(cOn(order));
      return order;
    });
  });
