import * as functions from 'firebase-functions';
import { isEmpty } from 'lodash';
import { DEFAULT_NETWORK, DEF_WALLET_PAY_IN_PROGRESS, MAX_WALLET_RETRY } from '../../../interfaces/config';
import { WEN_FUNC } from '../../../interfaces/functions';
import { Transaction, TransactionType, WalletResult } from '../../../interfaces/models';
import { COL } from '../../../interfaces/models/base';
import { Mnemonic } from '../../../interfaces/models/mnemonic';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { WalletService } from "../../services/wallet/wallet";
import { serverTime } from "../../utils/dateTime.utils";
import { executeTokenMinting } from './token-minting';
import { getWalletParams } from './wallet-params';

export const transactionWrite = functions.runWith({
  timeoutSeconds: 540,
  minInstances: scale(WEN_FUNC.transactionWrite),
  memory: "512MB",
}).firestore.document(COL.TRANSACTION + '/{tranId}').onWrite(async (change) => {
  const prev = <Transaction | undefined>change.before.data();
  const curr = <Transaction | undefined>change.after.data();

  const isCreditOrBillPayment = (curr?.type === TransactionType.CREDIT || curr?.type === TransactionType.BILL_PAYMENT);
  const isCreate = (prev === undefined);
  const shouldRetry = (!prev?.shouldRetry && curr?.shouldRetry);

  if (curr && isCreditOrBillPayment && !curr?.ignoreWallet && (isCreate || shouldRetry)) {
    return await executeBillOrCreditpayment(curr.uid)
  }

  if (curr && curr.type === TransactionType.MINT_TOKEN && (isCreate || shouldRetry)) {
    await executeTokenMinting(curr)
  }
})

const executeBillOrCreditpayment = async (transactionId: string) => {
  const shouldProcess = await prepareTransaction(transactionId)
  if (!shouldProcess) {
    return;
  }

  const docRef = admin.firestore().collection(COL.TRANSACTION).doc(transactionId);
  const transaction = <Transaction>(await docRef.get()).data();
  const payload = transaction.payload

  const params = await getWalletParams(transaction, transaction.network || DEFAULT_NETWORK)
  try {
    const walletService = await WalletService.newWallet(transaction.network || DEFAULT_NETWORK);
    const chainReference = await walletService.send(
      await walletService.getAddressDetails(payload.sourceAddress),
      payload.targetAddress,
      payload.amount,
      params
    )
    await docRef.update({
      'payload.walletReference.processedOn': serverTime(),
      'payload.walletReference.chainReference': chainReference,
      'payload.walletReference.chainReferences': admin.firestore.FieldValue.arrayUnion(chainReference),
      'payload.walletReference.inProgress': true
    })
  } catch (e) {
    functions.logger.error(transaction.uid, JSON.stringify(e))
    await docRef.update({
      'payload.walletReference.processedOn': serverTime(),
      'payload.walletReference.error': JSON.stringify(e),
    })
  }
}

const prepareTransaction = (transactionId: string) => admin.firestore().runTransaction(async (transaction) => {
  const docRef = admin.firestore().collection(COL.TRANSACTION).doc(transactionId)
  const tranData = <Transaction | undefined>(await transaction.get(docRef)).data();
  const walletResponse: WalletResult = tranData?.payload?.walletReference || emptyWalletResult()
  if (!tranData || !isEmpty(walletResponse.chainReference) || walletResponse.count > MAX_WALLET_RETRY) {
    transaction.update(docRef, { shouldRetry: false });
    return false;
  }

  if (await mnemonicsAreLocked(transaction, tranData) || tranData.payload.dependsOnBillPayment) {
    walletResponse.chainReference = null
    transaction.update(docRef, {
      shouldRetry: false,
      'payload.walletReference': walletResponse,
      'payload.dependsOnBillPayment': false
    });
    return false;
  }

  walletResponse.error = null;
  walletResponse.chainReference = DEF_WALLET_PAY_IN_PROGRESS + Date.now();
  walletResponse.count = walletResponse.count + 1;
  walletResponse.processedOn = serverTime();

  transaction.update(docRef, { shouldRetry: false, 'payload.walletReference': walletResponse });
  lockMnemonic(transaction, transactionId, tranData.payload.sourceAddress)
  lockMnemonic(transaction, transactionId, tranData.payload.storageDepositSourceAddress)

  return true
});

const emptyWalletResult = (): WalletResult => ({
  createdOn: serverTime(),
  processedOn: serverTime(),
  confirmed: false,
  chainReferences: [],
  count: 0
})

const getMnemonic = async (transaction: admin.firestore.Transaction, address: string): Promise<Mnemonic> => {
  if (isEmpty(address)) {
    return {}
  }
  const docRef = admin.firestore().doc(`${COL.MNEMONIC}/${address}`)
  return (await transaction.get(docRef)).data() || {}
}

const lockMnemonic = (transaction: admin.firestore.Transaction, lockedBy: string, address: string) => {
  if (isEmpty(address)) {
    return
  }
  const docRef = admin.firestore().doc(`${COL.MNEMONIC}/${address}`)
  transaction.update(docRef, { lockedBy, consumedOutputIds: [] });
}

const mnemonicsAreLocked = async (transaction: admin.firestore.Transaction, tran: Transaction) => {
  const sourceAddressMnemonic = await getMnemonic(transaction, tran.payload.sourceAddress)
  const storageDepositSourceAddress = await getMnemonic(transaction, tran.payload.storageDepositSourceAddress)
  return (sourceAddressMnemonic.lockedBy || tran.uid) !== tran.uid || (storageDepositSourceAddress.lockedBy || tran.uid) !== tran.uid
}
