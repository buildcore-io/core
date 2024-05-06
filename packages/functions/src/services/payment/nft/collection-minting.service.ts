import { PgCollectionUpdate, database } from '@buildcore/database';
import {
  COL,
  Collection,
  CollectionStatus,
  TransactionPayloadType,
  UnsoldMintingOptions,
} from '@buildcore/interfaces';
import { BaseService, HandlerParams } from '../base';
import { Action } from '../transaction-service';

export class CollectionMintingService extends BaseService {
  public handleRequest = async ({ order, match }: HandlerParams) => {
    const collectionDocRef = database().doc(COL.COLLECTION, order.payload.collection!);
    const collection = <Collection>await this.transaction.get(collectionDocRef);

    const payment = await this.transactionService.createPayment(order, match);
    if (collection.status !== CollectionStatus.PRE_MINTED) {
      await this.transactionService.createCredit(
        TransactionPayloadType.DATA_NO_LONGER_VALID,
        payment,
        match,
      );
      return;
    }
    this.transactionService.markAsReconciled(order, match.msgId);

    const collectionUpdateData: PgCollectionUpdate = {
      mintingData_mintingOrderId: order.uid,
      mintingData_network: order.network,
      mintingData_mintedBy: order.member,
      mintingData_unsoldMintingOptions:
        order.payload.unsoldMintingOptions || UnsoldMintingOptions.KEEP_PRICE,
      mintingData_newPrice: order.payload.newPrice || 0,
      mintingData_aliasStorageDeposit: order.payload.aliasStorageDeposit || 0,
      mintingData_storageDeposit: order.payload.collectionStorageDeposit || 0,
      mintingData_nftsStorageDeposit: order.payload.nftsStorageDeposit || 0,
      mintingData_address: order.payload.targetAddress,
      status: CollectionStatus.MINTING,
    };

    const newPrice = order.payload.newPrice || 0;
    if (newPrice) {
      collectionUpdateData.price = newPrice;
    }

    this.transactionService.push({
      ref: collectionDocRef,
      data: collectionUpdateData,
      action: Action.U,
    });
  };
}
