import { TransactionHelper } from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import * as functions from 'firebase-functions';
import { isEmpty } from 'lodash';
import { DEFAULT_NETWORK, DEF_WALLET_PAY_IN_PROGRESS, MAX_WALLET_RETRY } from '../../../interfaces/config';
import { WEN_FUNC } from '../../../interfaces/functions';
import { CollectionStatus, Transaction, TransactionChangeNftOrderType, TransactionType, WalletResult } from '../../../interfaces/models';
import { COL } from '../../../interfaces/models/base';
import { Mnemonic } from '../../../interfaces/models/mnemonic';
import { NftStatus } from '../../../interfaces/models/nft';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { WalletService } from "../../services/wallet/wallet";
import { serverTime } from "../../utils/dateTime.utils";
import { createNftMintingOrdersForCollection } from './collection-minting';
import { executeTokenMinting } from './token-minting';
import { getWalletParams } from './wallet-params';

export const EXECUTABLE_TRANSACTIONS = [
  TransactionType.CREDIT,
  TransactionType.BILL_PAYMENT,
  TransactionType.MINT_COLLECTION,
  TransactionType.MINT_NFTS,
  TransactionType.CHANGE_NFT_OWNER,
  TransactionType.CREDIT_NFT
]

export const transactionWrite = functions.runWith({
  timeoutSeconds: 540,
  minInstances: scale(WEN_FUNC.transactionWrite),
  memory: "4GB",
}).firestore.document(COL.TRANSACTION + '/{tranId}').onWrite(async (change) => {
  const prev = <Transaction | undefined>change.before.data();
  const curr = <Transaction | undefined>change.after.data();

  if (!curr) {
    return
  }

  const isExecutableType = EXECUTABLE_TRANSACTIONS.includes(curr.type)
  const isCreate = (prev === undefined);
  const shouldRetry = (!prev?.shouldRetry && curr?.shouldRetry);

  if (isExecutableType && !curr?.ignoreWallet && (isCreate || shouldRetry)) {
    return await executeTransaction(curr.uid)
  }

  if (curr.type === TransactionType.MINT_TOKEN && (isCreate || shouldRetry)) {
    await executeTokenMinting(curr)
  }

  if (curr.type === TransactionType.MINT_COLLECTION && isConfirmed(prev, curr)) {
    await createNftMintingOrdersForCollection(curr)
  }

  if (curr.type === TransactionType.MINT_NFTS && isConfirmed(prev, curr)) {
    await onNftMintSuccess(curr)
  }

  if (curr.payload.type === TransactionChangeNftOrderType.SEND_COLLECTION_NFT_TO_GUARDIAN && isConfirmed(prev, curr)) {
    await onCollectionNftTransferedToGuardian(curr)
  }
})

const executeTransaction = async (transactionId: string) => {
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
    const sourceAddress = await walletService.getAddressDetails(payload.sourceAddress)

    const submit = () => {
      switch (transaction.type) {
        case TransactionType.BILL_PAYMENT:
        case TransactionType.CREDIT:
          return walletService.send(sourceAddress, payload.targetAddress, payload.amount, params)
        case TransactionType.MINT_COLLECTION: {
          return (walletService as SmrWallet).mintCollection(sourceAddress, transaction.payload.collection, params)
        }
        case TransactionType.MINT_NFTS: {
          return (walletService as SmrWallet).mintNfts(transaction, params)
        }
        case TransactionType.CHANGE_NFT_OWNER:
        case TransactionType.CREDIT_NFT: {
          return (walletService as SmrWallet).changeNftOwner(transaction, params)
        }
        default: {
          functions.logger.error('Unsupported executable transaction type', transaction)
          throw Error('Unsupported executable transaction type ' + transaction.type)
        }
      }
    }

    const chainReference = await submit()
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
  transaction.update(docRef, { lockedBy, consumedOutputIds: [], consumedNftOutputIds: [] });
}

const mnemonicsAreLocked = async (transaction: admin.firestore.Transaction, tran: Transaction) => {
  const sourceAddressMnemonic = await getMnemonic(transaction, tran.payload.sourceAddress)
  const storageDepositSourceAddress = await getMnemonic(transaction, tran.payload.storageDepositSourceAddress)
  return (sourceAddressMnemonic.lockedBy || tran.uid) !== tran.uid || (storageDepositSourceAddress.lockedBy || tran.uid) !== tran.uid
}

const isConfirmed = (prev: Transaction | undefined, curr: Transaction | undefined) =>
  !prev?.payload?.walletReference?.confirmed && curr?.payload?.walletReference?.confirmed

const onNftMintSuccess = async (transaction: Transaction) => {
  await admin.firestore().doc(`${COL.COLLECTION}/${transaction.payload.collection}`).update({
    'mintingData.nftsToMint': admin.firestore.FieldValue.increment(-transaction.payload.nfts.length)
  })
  const milestoneTransaction = (await admin.firestore().doc(transaction.payload.walletReference.milestoneTransactionPath).get()).data()!
  const promises = (transaction.payload.nfts as string[]).map((nftId, i) => {
    const outputId = Converter.bytesToHex(TransactionHelper.getTransactionPayloadHash(milestoneTransaction.payload), true) + indexToString(i + 1);
    return admin.firestore().doc(`${COL.NFT}/${nftId}`).update({
      'mintingData.mintedOn': serverTime(),
      'mintingData.mintedBy': transaction.member,
      'mintingData.blockId': milestoneTransaction.blockId,
      'mintingData.nftId': TransactionHelper.resolveIdFromOutputId(outputId),
      status: NftStatus.MINTED
    })
  }
  )
  await Promise.all(promises)
}

const onCollectionNftTransferedToGuardian = async (transaction: Transaction) => {
  const milestoneTransaction = (await admin.firestore().doc(transaction.payload.walletReference.milestoneTransactionPath).get()).data()!
  const nftId = milestoneTransaction.payload.essence.outputs[0].nftId
  await admin.firestore().doc(`${COL.COLLECTION}/${transaction.payload.collection}`).update({
    'mintingData.address': '',
    'mintingData.nftId': nftId,
    status: CollectionStatus.MINTED
  })
}

const indexToString = (index: number) => {
  let str = `0${index}`
  while (str.length < 4) {
    str = str + '0'
  }
  return str
}
