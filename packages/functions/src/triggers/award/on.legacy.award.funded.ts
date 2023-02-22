import {
  COL,
  Transaction,
  TransactionOrderType,
  TRANSACTION_AUTO_EXPIRY_MS,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import admin from '../../admin.config';
import { WalletService } from '../../services/wallet/wallet';
import { dateToTimestamp } from '../../utils/dateTime.utils';

export const onLegacyAwardFunded = async (legacyFundOrder: Transaction) => {
  const batch = admin.firestore().batch();

  const orders = await getFundAwardOrder(legacyFundOrder);

  if (isEmpty(orders)) {
    return;
  }

  const legacyFundOrderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${legacyFundOrder.uid}`);
  batch.update(legacyFundOrderDocRef, { 'payload.legacyAwardsBeeingFunded': orders.length });

  orders.forEach((order) => {
    const orderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`);
    batch.update(orderDocRef, {
      'payload.legacyAwardFundRequestId': legacyFundOrder.uid,
      'payload.expiresOn': dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
      'payload.void': false,
      'payload.nativeTokens': [
        {
          id: legacyFundOrder.payload.nativeTokens[0].id,
          amount: order.payload.nativeTokens[0].amount,
        },
      ],
    });
  });

  const targets = orders.map((order) => ({
    toAddress: order.payload.targetAddress,
    amount: order.payload.amount,
    nativeTokens: order.payload.nativeTokens,
  }));

  const wallet = await WalletService.newWallet(legacyFundOrder.network);
  const sourceAddress = await wallet.getAddressDetails(legacyFundOrder.payload.targetAddress);
  await wallet.sendToMany(sourceAddress, targets, {});

  await batch.commit();
};

const getFundAwardOrder = async (order: Transaction) => {
  let query = admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('payload.type', '==', TransactionOrderType.FUND_AWARD)
    .where('payload.isLegacyAward', '==', true)
    .where('payload.reconciled', '==', false)
    .limit(63);
  if (!isEmpty(order.payload.awards)) {
    query = query.where('payload.award', 'in', order.payload.awards);
  }
  const snap = await query.get();
  return snap.docs.map((doc) => doc.data() as Transaction);
};
