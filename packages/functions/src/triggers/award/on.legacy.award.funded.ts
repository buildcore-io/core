import { COL, Transaction, TransactionOrderType } from '@soonaverse/interfaces';
import { isEmpty } from 'lodash';
import admin from '../../admin.config';
import { WalletService } from '../../services/wallet/wallet';

export const onLegacyAwardFunded = async (legacyFundOrder: Transaction) => {
  const batch = admin.firestore().batch();

  const orders = await getFundAwardOrder();

  if (isEmpty(orders)) {
    return;
  }

  const legacyFundOrderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${legacyFundOrder.uid}`);
  batch.update(legacyFundOrderDocRef, { 'payload.legacyAwardsBeeingFunded': orders.length });

  orders.forEach((order) => {
    const orderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`);
    batch.update(orderDocRef, { 'payload.legacyAwardFundRequestId': legacyFundOrder.uid });
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

const getFundAwardOrder = async () => {
  const snap = await admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('payload.type', '==', TransactionOrderType.FUND_AWARD)
    .where('payload.isLegacyAward', '==', true)
    .where('payload.reconciled', '==', false)
    .limit(63)
    .get();
  return snap.docs.map((doc) => doc.data() as Transaction);
};
