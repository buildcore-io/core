import {
  COL,
  MAX_WALLET_RETRY,
  RETRY_UNCOFIRMED_PAYMENT_DELAY,
  Transaction,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../admin.config';
import { uOn } from '../utils/dateTime.utils';

export const retryWallet = async () => {
  const snap = await getFailedTransactionsSnap();
  const promises = snap.docs.map((doc) =>
    admin.firestore().runTransaction(async (transaction) => {
      const sfDoc = await transaction.get(doc.ref);
      return await rerunTransaction(transaction, sfDoc);
    }),
  );
  return await Promise.all(promises);
};

const rerunTransaction = async (
  transaction: admin.firestore.Transaction,
  doc: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>,
) => {
  const data = <Transaction>doc.data();
  const walletReference = data.payload.walletReference;
  const processedOn = dayjs(walletReference.processedOn.toDate());
  if (
    walletReference.confirmed ||
    processedOn.add(RETRY_UNCOFIRMED_PAYMENT_DELAY).isAfter(dayjs())
  ) {
    return;
  }
  if (walletReference.count === MAX_WALLET_RETRY) {
    const sourceMnemonicDocRef = admin
      .firestore()
      .doc(`${COL.MNEMONIC}/${data.payload.sourceAddress}`);
    transaction.update(
      sourceMnemonicDocRef,
      uOn({
        lockedBy: '',
        consumedOutputIds: [],
        consumedNftOutputIds: [],
        consumedAliasOutputIds: [],
      }),
    );
    if (data.payload.storageDepositSourceAddress) {
      const storageSourceDocRef = admin
        .firestore()
        .doc(`${COL.MNEMONIC}/${data.payload.storageDepositSourceAddress}`);
      transaction.update(
        storageSourceDocRef,
        uOn({
          lockedBy: '',
          consumedOutputIds: [],
          consumedNftOutputIds: [],
          consumedAliasOutputIds: [],
        }),
      );
    }
    transaction.update(
      doc.ref,
      uOn({
        'payload.walletReference.chainReference': null,
        'payload.walletReference.inProgress': false,
        'payload.walletReference.count': admin.firestore.FieldValue.increment(1),
        shouldRetry: false,
      }),
    );
  }
  transaction.update(
    doc.ref,
    uOn({
      'payload.walletReference.chainReference': null,
      shouldRetry: true,
    }),
  );
  return doc.id;
};

const getFailedTransactionsSnap = () =>
  admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('payload.walletReference.confirmed', '==', false)
    .where('payload.walletReference.inProgress', '==', true)
    .where('payload.walletReference.count', '<=', MAX_WALLET_RETRY)
    .get();
