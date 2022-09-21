import { Collection, CollectionStatus, TransactionOrder } from '../../../../interfaces/models';
import { COL } from '../../../../interfaces/models/base';
import admin from '../../../admin.config';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class CollectionMintingService {
  constructor(readonly transactionService: TransactionService) { }

  public handleCollectionMintingRequest = async (order: TransactionOrder, match: TransactionMatch) => {
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${order.payload.collection}`)
    const collection = <Collection>(await this.transactionService.transaction.get(collectionDocRef)).data()

    const payment = this.transactionService.createPayment(order, match);
    if (collection.status !== CollectionStatus.PRE_MINTED) {
      this.transactionService.createCredit(payment, match);
      return;
    }
    await this.transactionService.markAsReconciled(order, match.msgId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { unsoldMintingOptions, newPrice, aliasStorageDeposit, collectionStorageDeposit, nftsStorageDeposit } = order.payload as any
    const data = {
      'mintingData.mintingOrderId': order.uid,
      'mintingData.network': order.network,
      'mintingData.mintedBy': order.member,
      'mintingData.unsoldMintingOptions': unsoldMintingOptions,
      'mintingData.newPrice': newPrice,
      'mintingData.aliasStorageDeposit': aliasStorageDeposit,
      'mintingData.storageDeposit': collectionStorageDeposit,
      'mintingData.nftsStorageDeposit': nftsStorageDeposit,
      'mintingData.address': order.payload.targetAddress,
      status: CollectionStatus.MINTING
    }
    this.transactionService.updates.push({ ref: collectionDocRef, data, action: 'update' })
  }

}
