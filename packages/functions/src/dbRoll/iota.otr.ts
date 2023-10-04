import {
  COL,
  Network,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions/v2';
import { build5Db } from '../firebase/firestore/build5Db';
import { WalletService } from '../services/wallet/wallet.service';
import { generateRandomAmount } from '../utils/common.utils';
import { isProdEnv } from '../utils/config.utils';
import { dateToTimestamp, serverTime } from '../utils/dateTime.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

export const iotaOtr = functions.https.onRequest(async () => {
  const network = isProdEnv() ? Network.IOTA : Network.ATOI;

  const walletService = await WalletService.newWallet(network);
  const targetAddress = await walletService.getNewIotaAddressDetails();
  const order = {
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    network,
    createdOn: serverTime(),
    payload: {
      type: TransactionPayloadType.TANGLE_REQUEST,
      amount: generateRandomAmount(),
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs().add(100, 'y')),
      validationType: TransactionValidationType.ADDRESS,
      reconciled: false,
      void: false,
      chainReference: null,
    },
    linkedTransactions: [],
  };
  await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
});
