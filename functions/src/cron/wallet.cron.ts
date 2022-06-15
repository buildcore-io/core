import dayjs from 'dayjs';
import { DEFAULT_TRANSACTION_RETRY, DEF_WALLET_PAY_IN_PROGRESS, EXTENDED_TRANSACTION_RETRY, MAX_WALLET_RETRY } from '../../interfaces/config';
import { Transaction } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import admin from '../admin.config';

export const retryWallet = async () => {
  const snap = await getFailedTransactionsSnap()
  const promises = snap.docs.map(doc =>
    admin.firestore().runTransaction(async (transaction) => {
      const sfDoc = await transaction.get(doc.ref);
      const data = await rerunTransaction(<Transaction>sfDoc.data())
      data && transaction.update(doc.ref, data);
    })
  )
  await Promise.all(promises)
}

const rerunTransaction = async (transaction: Transaction) => {
  const walletReference = transaction.payload.walletReference

  if (!walletReference?.chainReference || !walletReference.processedOn || walletReference.confirmed) {
    return;
  }

  const retryCount = walletReference.count
  const processedOn = dayjs(walletReference.processedOn.toDate())
  const readyToRun = processedOn.add(getDelay(retryCount), 'ms').isAfter(dayjs())
  const readyToReprocessedWallet = processedOn.add(getDelay(retryCount, true), 'ms').isAfter(dayjs())
  const payInProgress = walletReference.chainReference.startsWith(DEF_WALLET_PAY_IN_PROGRESS)
  if (readyToRun || (readyToReprocessedWallet && payInProgress)) {
    return;
  }

  const subColSnap = await admin.firestore().collectionGroup(SUB_COL.TRANSACTIONS).where('messageId', '==', walletReference.chainReference).get();
  const data: Transaction = { ...transaction }
  if (subColSnap.size > 0) {
    data.payload.walletReference.confirmed = true;
  } else {
    if (data.payload.walletReference) {
      data.payload.walletReference.error = 'Unable to find on chain. Retry.';
    }
    data.shouldRetry = true
  }
  return data
}

const getDelay = (retryCount: number, extended?: boolean) => {
  const base = extended ? EXTENDED_TRANSACTION_RETRY : DEFAULT_TRANSACTION_RETRY
  return base + getDelayForRetryCount(retryCount) + getRandomDelay()
}

const getDelayForRetryCount = (retryCount: number) => {
  switch (retryCount) {
    case 0: return 0
    case 1: return 60 * 1000
    case 2: return 3 * 60 * 1000
    case 3: return 10 * 60 * 1000
    case 4: return 30 * 60 * 1000
    default: return 60 * 60 * 1000
  }
}

// Return a random ms between -30 and 30 seconds
const getRandomDelay = () => Math.floor(Math.random() * (2 * 30 * 1000)) - 30 * 1000

const getFailedTransactionsSnap = () => admin.firestore().collection(COL.TRANSACTION)
  .where('payload.walletReference.confirmed', '==', false)
  .where('payload.walletReference.count', '<', MAX_WALLET_RETRY)
  .get()
