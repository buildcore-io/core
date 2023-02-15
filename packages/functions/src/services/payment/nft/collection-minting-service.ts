import {
  COL,
  Collection,
  CollectionStatus,
  TransactionCreditType,
  TransactionOrder,
  UnsoldMintingOptions,
} from '@soonaverse/interfaces';
import { get } from 'lodash';
import admin from '../../../admin.config';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class CollectionMintingService {
  constructor(readonly transactionService: TransactionService) {}

  public handleCollectionMintingRequest = async (
    order: TransactionOrder,
    match: TransactionMatch,
  ) => {
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${order.payload.collection}`);
    const collection = <Collection>(
      (await this.transactionService.transaction.get(collectionDocRef)).data()
    );

    const payment = await this.transactionService.createPayment(order, match);
    if (collection.status !== CollectionStatus.PRE_MINTED) {
      await this.transactionService.createCredit(
        TransactionCreditType.DATA_NO_LONGER_VALID,
        payment,
        match,
      );
      return;
    }
    this.transactionService.markAsReconciled(order, match.msgId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {
      'mintingData.mintingOrderId': order.uid,
      'mintingData.network': order.network,
      'mintingData.mintedBy': order.member,
      'mintingData.unsoldMintingOptions': get(
        order,
        'payload.unsoldMintingOptions',
        UnsoldMintingOptions.KEEP_PRICE,
      ),
      'mintingData.newPrice': get(order, 'payload.newPrice', 0),
      'mintingData.aliasStorageDeposit': get(order, 'payload.aliasStorageDeposit', 0),
      'mintingData.storageDeposit': get(order, 'payload.collectionStorageDeposit', 0),
      'mintingData.nftsStorageDeposit': get(order, 'payload.nftsStorageDeposit', 0),
      'mintingData.address': order.payload.targetAddress,
      status: CollectionStatus.MINTING,
    };

    // We have to set new default price on collection as well.
    if (get(order, 'payload.newPrice', 0)) {
      data.price = get(order, 'payload.newPrice', 0);
    }

    this.transactionService.updates.push({ ref: collectionDocRef, data, action: 'update' });
  };
}
