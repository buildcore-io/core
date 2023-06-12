import {
  COL,
  MAX_WALLET_RETRY,
  RETRY_UNCOFIRMED_PAYMENT_DELAY,
  Transaction,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { ITransaction } from '../firebase/firestore/interfaces';
import { soonDb } from '../firebase/firestore/soondb';

export const retryWallet = async () => {
  const snap = await getFailedTransactionsSnap();
  const promises = snap.map((doc) =>
    soonDb().runTransaction(async (transaction) => {
      const docRef = soonDb().doc(`${COL.TRANSACTION}/${doc.uid}`);
      const tran = (await transaction.get<Transaction>(docRef))!;
      return await rerunTransaction(transaction, tran);
    }),
  );
  return await Promise.all(promises);
};

const rerunTransaction = async (transaction: ITransaction, data: Transaction) => {
  const docRef = soonDb().doc(`${COL.TRANSACTION}/${data.uid}`);
  const walletReference = data.payload.walletReference;
  const processedOn = dayjs(walletReference.processedOn.toDate());
  if (
    walletReference.confirmed ||
    processedOn.add(RETRY_UNCOFIRMED_PAYMENT_DELAY).isAfter(dayjs())
  ) {
    return;
  }
  if (walletReference.count === MAX_WALLET_RETRY) {
    const sourceMnemonicDocRef = soonDb().doc(`${COL.MNEMONIC}/${data.payload.sourceAddress}`);
    transaction.update(sourceMnemonicDocRef, {
      lockedBy: '',
      consumedOutputIds: [],
      consumedNftOutputIds: [],
      consumedAliasOutputIds: [],
    });
    if (data.payload.storageDepositSourceAddress) {
      const storageSourceDocRef = soonDb().doc(
        `${COL.MNEMONIC}/${data.payload.storageDepositSourceAddress}`,
      );
      transaction.update(storageSourceDocRef, {
        lockedBy: '',
        consumedOutputIds: [],
        consumedNftOutputIds: [],
        consumedAliasOutputIds: [],
      });
    }
    transaction.update(docRef, {
      'payload.walletReference.chainReference': null,
      'payload.walletReference.inProgress': false,
      'payload.walletReference.count': soonDb().inc(1),
      shouldRetry: false,
    });
  }
  transaction.update(docRef, {
    'payload.walletReference.chainReference': null,
    shouldRetry: true,
  });
  return data.uid;
};

const COUNT_IN = Array.from(Array(MAX_WALLET_RETRY + 1)).map((_, i) => i);

const getFailedTransactionsSnap = () =>
  soonDb()
    .collection(COL.TRANSACTION)
    .where('payload.walletReference.confirmed', '==', false)
    .where('payload.walletReference.inProgress', '==', true)
    .where('payload.walletReference.count', 'in', COUNT_IN)
    .get<Transaction>();
