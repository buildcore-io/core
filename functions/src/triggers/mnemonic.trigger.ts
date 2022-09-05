import * as functions from 'firebase-functions';
import { isEmpty } from 'lodash';
import { MAX_WALLET_RETRY } from '../../interfaces/config';
import { WEN_FUNC } from '../../interfaces/functions';
import { TransactionType } from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';
import { Mnemonic } from '../../interfaces/models/mnemonic';
import admin from '../admin.config';
import { scale } from '../scale.settings';

export const mnemonicWrite = functions.runWith({
  timeoutSeconds: 540,
  minInstances: scale(WEN_FUNC.mnemonicWrite),
  memory: "512MB",
}).firestore.document(COL.MNEMONIC + '/{address}').onWrite(async (change, context) => {
  const prev = <Mnemonic | undefined>change.before.data()
  const curr = <Mnemonic | undefined>change.after.data()
  if (!prev || !curr || isEmpty(prev?.lockedBy) || !isEmpty(curr?.lockedBy)) {
    return;
  }

  const address = context.params.address as string
  const sourceAddressTrans = (await getUncofirmedTransactionsByFieldName('payload.sourceAddress', address)).docs
  const sourceAddressTransIds = sourceAddressTrans.map(d => d.id)
  const storageDepositAddressTrans = (await getUncofirmedTransactionsByFieldName('payload.storageDepositSourceAddress', address)).docs
    .filter(doc => !sourceAddressTransIds.includes(doc.id))

  await rerunTransaction(sourceAddressTrans)
  await rerunTransaction(storageDepositAddressTrans)
})

const getUncofirmedTransactionsByFieldName = (fieldName: FieldNameType, address: string) => admin.firestore().collection(COL.TRANSACTION)
  .where(fieldName, '==', address)
  .where('payload.walletReference.chainReference', '==', null)
  .where('payload.walletReference.count', '<', MAX_WALLET_RETRY)
  .get()

type FieldNameType = 'payload.sourceAddress' | 'payload.storageDepositSourceAddress'

const rerunTransaction = async (transactions: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>[]) => {
  const tranId = transactions.find(doc => doc.data()?.type === TransactionType.BILL_PAYMENT)?.id ||
    transactions.find(doc => doc.data()?.type === TransactionType.CREDIT)?.id
  if (!isEmpty(tranId)) {
    await admin.firestore().doc(`${COL.TRANSACTION}/${tranId}`).update({ shouldRetry: true, 'payload.walletReference.inProgress': false })
  }
}
