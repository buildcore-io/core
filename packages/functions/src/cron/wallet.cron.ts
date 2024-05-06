import { ITransaction, database } from '@buildcore/database';
import {
  COL,
  MAX_WALLET_RETRY,
  RETRY_UNCOFIRMED_PAYMENT_DELAY,
  Transaction,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';

export const retryWallet = async () => {
  const snap = await getFailedTransactionsSnap();
  const promises = snap.map((doc) =>
    database().runTransaction(async (transaction) => {
      const docRef = database().doc(COL.TRANSACTION, doc.uid);
      const tran = (await transaction.get(docRef))!;
      return await rerunTransaction(transaction, tran);
    }),
  );
  return await Promise.all(promises);
};

const rerunTransaction = async (transaction: ITransaction, data: Transaction) => {
  const docRef = database().doc(COL.TRANSACTION, data.uid);
  const walletReference = data.payload.walletReference!;
  const processedOn = dayjs(walletReference.processedOn.toDate());
  const delay = RETRY_UNCOFIRMED_PAYMENT_DELAY[(walletReference.count || 1) - 1];

  if (walletReference.confirmed || processedOn.add(delay).isAfter(dayjs())) {
    return;
  }

  if (walletReference.count === MAX_WALLET_RETRY) {
    const sourceMnemonicDocRef = database().doc(COL.MNEMONIC, data.payload.sourceAddress!);
    await transaction.update(sourceMnemonicDocRef, {
      lockedBy: '',
      consumedOutputIds: [],
      consumedNftOutputIds: [],
      consumedAliasOutputIds: [],
    });
    if (data.payload.storageDepositSourceAddress) {
      const storageSourceDocRef = database().doc(
        COL.MNEMONIC,
        data.payload.storageDepositSourceAddress,
      );
      await transaction.update(storageSourceDocRef, {
        lockedBy: '',
        consumedOutputIds: [],
        consumedNftOutputIds: [],
        consumedAliasOutputIds: [],
      });
    }
    await transaction.update(docRef, {
      payload_walletReference_chainReference: undefined,
      payload_walletReference_inProgress: false,
      payload_walletReference_count: database().inc(1),
      shouldRetry: false,
    });
  }
  await transaction.update(docRef, {
    payload_walletReference_chainReference: undefined,
    shouldRetry: true,
  });
  return data.uid;
};

const getFailedTransactionsSnap = () =>
  database()
    .collection(COL.TRANSACTION)
    .where('payload_walletReference_confirmed', '==', false)
    .where('payload_walletReference_inProgress', '==', true)
    .where('payload_walletReference_count', '<=', MAX_WALLET_RETRY)
    .get();
