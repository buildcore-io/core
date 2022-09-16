import dayjs from 'dayjs';
import { MAX_WALLET_RETRY, RETRY_UNCOFIRMED_PAYMENT_DELAY } from '../../interfaces/config';
import { Transaction } from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';
import admin from '../admin.config';

export const retryWallet = async () => {
  const snap = await getFailedTransactionsSnap()
  const promises = snap.docs.map(doc =>
    admin.firestore().runTransaction(async (transaction) => {
      const sfDoc = await transaction.get(doc.ref);
      return await rerunTransaction(transaction, sfDoc)
    })
  )
  return await Promise.all(promises)
}

const rerunTransaction = async (transaction: admin.firestore.Transaction, doc: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>) => {
  const data = <Transaction>doc.data()
  const walletReference = data.payload.walletReference
  const processedOn = dayjs(walletReference.processedOn.toDate())
  if (walletReference.confirmed || processedOn.add(RETRY_UNCOFIRMED_PAYMENT_DELAY).isAfter(dayjs())) {
    return
  }
  if (walletReference.count === MAX_WALLET_RETRY) {
    const sourceMnemonicDocRef = admin.firestore().doc(`${COL.MNEMONIC}/${data.payload.sourceAddress}`)
    transaction.update(sourceMnemonicDocRef, { lockedBy: '', consumedOutputIds: [], consumedNftOutputIds: [], consumedAliasOutputIds: [] })
    if (data.payload.storageDepositSourceAddress) {
      const storageSourceDocRef = admin.firestore().doc(`${COL.MNEMONIC}/${data.payload.storageDepositSourceAddress}`)
      transaction.update(storageSourceDocRef, { lockedBy: '', consumedOutputIds: [], consumedNftOutputIds: [], consumedAliasOutputIds: [] })
    }
    return transaction.update(doc.ref, {
      'payload.walletReference.chainReference': null,
      'payload.walletReference.inProgress': false,
      'payload.walletReference.count': admin.firestore.FieldValue.increment(1),
      shouldRetry: false
    })
  }
  return transaction.update(doc.ref, {
    'payload.walletReference.chainReference': null,
    shouldRetry: true
  })
}

const getFailedTransactionsSnap = () => admin.firestore().collection(COL.TRANSACTION)
  .where('payload.walletReference.confirmed', '==', false)
  .where('payload.walletReference.inProgress', '==', true)
  .where('payload.walletReference.count', '<=', MAX_WALLET_RETRY)
  .get()
