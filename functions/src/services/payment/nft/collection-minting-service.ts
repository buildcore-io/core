import { get } from 'lodash';
import { Collection, CollectionStatus, Transaction, TransactionMintCollectionType, TransactionOrder, TransactionType } from '../../../../interfaces/models';
import { COL } from '../../../../interfaces/models/base';
import admin from '../../../admin.config';
import { serverTime } from '../../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class CollectionMintingService {
  constructor(readonly transactionService: TransactionService) { }

  public handleCollectionMintingRequest = async (order: TransactionOrder, match: TransactionMatch) => {
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${order.payload.collection}`)
    const collection = <Collection>(await this.transactionService.transaction.get(collectionDocRef)).data()

    const payment = this.transactionService.createPayment(order, match);
    if (collection.status !== CollectionStatus.READY_TO_MINT) {
      this.transactionService.createCredit(payment, match);
      return;
    }
    await this.transactionService.markAsReconciled(order, match.msgId)

    const data = {
      'mintingData.mintingOrderId': order.uid,
      'mintingData.network': order.network,
      status: CollectionStatus.MINTING
    }
    this.transactionService.updates.push({ ref: collectionDocRef, data, action: 'update' })

    const mintingTransaction = <Transaction>{
      type: TransactionType.MINT_COLLECTION,
      uid: getRandomEthAddress(),
      member: order.member,
      space: collection.space,
      createdOn: serverTime(),
      network: order.network,
      payload: {
        type: TransactionMintCollectionType.MINT_ALIAS,
        amount: get(order, 'payload.aliasStorageDeposit', 0),
        sourceAddress: order.payload.targetAddress,
        collection: order.payload.collection,
        collectionStorageDeposit: get(order, 'payload.collectionStorageDeposit', 0),
        nftStorageDeposit: get(order, 'payload.nftStorageDeposit', 0)
      }
    }
    this.transactionService.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${mintingTransaction.uid}`),
      data: mintingTransaction,
      action: 'set'
    })
  }

}
