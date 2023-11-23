import { ITransaction, build5Db } from '@build-5/database';
import {
  COL,
  MAX_WALLET_RETRY,
  RETRY_UNCOFIRMED_PAYMENT_DELAY,
  Transaction,
} from '@build-5/interfaces';
import dayjs from 'dayjs';

export const retryWallet = async () => {
  const snap = await getFailedTransactionsSnap();
  const promises = snap.map((doc) =>
    build5Db().runTransaction(async (transaction) => {
      const docRef = build5Db().doc(`${COL.TRANSACTION}/${doc.uid}`);
      const tran = (await transaction.get<Transaction>(docRef))!;
      return await rerunTransaction(transaction, tran);
    }),
  );
  return await Promise.all(promises);
};

const rerunTransaction = async (transaction: ITransaction, data: Transaction) => {
  const docRef = build5Db().doc(`${COL.TRANSACTION}/${data.uid}`);
  const walletReference = data.payload.walletReference!;
  const processedOn = dayjs(walletReference.processedOn.toDate());
  const delay = RETRY_UNCOFIRMED_PAYMENT_DELAY[(walletReference.count || 1) - 1];

  if (walletReference.confirmed || processedOn.add(delay).isAfter(dayjs())) {
    return;
  }

  if (walletReference.count === MAX_WALLET_RETRY) {
    const sourceMnemonicDocRef = build5Db().doc(`${COL.MNEMONIC}/${data.payload.sourceAddress}`);
    transaction.update(sourceMnemonicDocRef, {
      lockedBy: '',
      consumedOutputIds: [],
      consumedNftOutputIds: [],
      consumedAliasOutputIds: [],
    });
    if (data.payload.storageDepositSourceAddress) {
      const storageSourceDocRef = build5Db().doc(
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
      'payload.walletReference.count': build5Db().inc(1),
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
  build5Db()
    .collection(COL.TRANSACTION)
    .where('payload.walletReference.confirmed', '==', false)
    .where('payload.walletReference.inProgress', '==', true)
    .where('payload.walletReference.count', 'in', COUNT_IN)
    .get<Transaction>();
