/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  COL,
  Network,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import admin from '../../admin.config';
import { WalletService } from '../../services/wallet/wallet';
import { generateRandomAmount } from '../../utils/common.utils';
import { isProdEnv } from '../../utils/config.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const createOnTangleOrder = functions.https.onRequest(async (_req, res) => {
  const networks = isProdEnv() ? [Network.SMR] : [Network.SMR, Network.RMS];
  for (const network of networks) {
    await createTangleOrder(network);
  }
  res.send(200);
});

const createTangleOrder = async (network: Network) => {
  const tangleOrderSnap = await admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('payload.type', '==', TransactionOrderType.TANGLE_REQUEST)
    .where('network', '==', network)
    .get();
  if (tangleOrderSnap.size) {
    return;
  }

  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const order = {
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    network,
    payload: {
      type: TransactionOrderType.TANGLE_REQUEST,
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
  await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
};
