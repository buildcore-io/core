import dayjs from 'dayjs';
import { DEFAULT_NETWORK, DEFAULT_TRANSACTION_RETRY, EXTENDED_TRANSACTION_RETRY, MAX_WALLET_RETRY, RETRY_UNCOFIRMED_PAYMENT_DELAY } from '../../interfaces/config';
import { Network, Transaction } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import admin from '../admin.config';
import { isEmulatorEnv } from '../utils/config.utils';

export const retryWallet = async () => {
  const snap = await getFailedTransactionsSnap()
  const promises = snap.docs.map(doc =>
    admin.firestore().runTransaction(async (transaction) => {
      const sfDoc = await transaction.get(doc.ref);
      const data = await rerunTransaction(<Transaction>sfDoc.data())
      data && transaction.update(doc.ref, data);
      return data
    })
  )
  return await Promise.all(promises)
}

const rerunTransaction = async (transaction: Transaction) => {
  const walletReference = transaction.payload.walletReference
  const retryCount = walletReference.count
  const processedOn = dayjs(walletReference.processedOn.toDate())
  if (
    (walletReference?.chainReference && processedOn.add(RETRY_UNCOFIRMED_PAYMENT_DELAY).isAfter(dayjs())) ||
    walletReference.confirmed) {
    return;
  }
  const readyToRun = processedOn.add(getDelay(retryCount), 'ms').isAfter(dayjs())
  const readyToReprocessedWallet = processedOn.add(getDelay(retryCount, true), 'ms').isAfter(dayjs())
  if (readyToRun || readyToReprocessedWallet) {
    return;
  }

  const field = getMessageIdFieldNameByNetwork(transaction.network || DEFAULT_NETWORK)
  const subColSnap = await admin.firestore().collectionGroup(SUB_COL.TRANSACTIONS)
    .where(field, '==', walletReference.chainReference)
    .get();
  if (subColSnap.size > 0) {
    return { 'payload.walletReference.confirmed': true }
  }
  return {
    'payload.walletReference.chainReference': null,
    'payload.walletReference.error': 'Unable to find on chain. Retry.',
    shouldRetry: true
  }
}

const getDelay = (retryCount: number, extended?: boolean) => {
  if (isEmulatorEnv) {
    return -60 * 1000
  }
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

export const getMessageIdFieldNameByNetwork = (network: Network) => {
  switch (network) {
    case Network.SMR:
    case Network.RMS: return 'blockId';
    default: return 'messageId'
  }
}
