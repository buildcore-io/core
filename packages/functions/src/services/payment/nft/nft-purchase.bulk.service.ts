import { database } from '@buildcore/database';
import {
  COL,
  Collection,
  Entity,
  Nft,
  NftBulkOrder,
  SUB_COL,
  Space,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  getMilestoneCol,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { get } from 'lodash';
import { getAddress } from '../../../utils/address.utils';
import { getRestrictions } from '../../../utils/common.utils';
import { dateToTimestamp } from '../../../utils/dateTime.utils';
import { getSpace } from '../../../utils/space.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { WalletService } from '../../wallet/wallet.service';
import { BaseService, HandlerParams } from '../base';
import { assertNftCanBePurchased, getMember } from '../tangle-service/nft/nft-purchase.service';
import { Action } from '../transaction-service';
import { NftPurchaseService } from './nft-purchase.service';

export class NftPurchaseBulkService extends BaseService {
  public handleRequest = async ({ order, match, tran, project }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);

    const promises = (order.payload.nftOrders || []).map((nftOrder) =>
      this.createNftPurchaseOrder(project, order, nftOrder),
    );
    const nftOrders = await Promise.all(promises);

    const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
    this.transactionService.push({
      ref: orderDocRef,
      data: {
        payload_nftOrders: JSON.stringify(nftOrders),
        payload_reconciled: true,
        payload_chainReference: match.msgId,
      },
      action: Action.U,
    });

    const total = nftOrders.reduce((acc, act) => acc + act.price, 0);

    const targetAddresses = nftOrders
      .filter((o) => o.price > 0)
      .map((o) => ({
        toAddress: o.targetAddress!,
        amount: o.price,
      }));
    const transfer: Transaction = {
      project,
      type: TransactionType.UNLOCK,
      uid: getRandomEthAddress(),
      space: order.space || '',
      member: order.member || match.from,
      network: order.network,
      payload: {
        type: TransactionPayloadType.TANGLE_TRANSFER_MANY,
        amount: total,
        sourceAddress: order.payload.targetAddress,
        targetAddresses,
        sourceTransaction: [payment.uid],
        expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
        milestoneTransactionPath: `${getMilestoneCol(order.network!)}/${tran.milestone}/${SUB_COL.TRANSACTIONS}/${tran.uid}`,
      },
    };
    const docRef = database().doc(COL.TRANSACTION, transfer.uid);
    this.transactionService.push({ ref: docRef, data: transfer, action: Action.C });
  };

  private createNftPurchaseOrder = async (
    project: string,
    order: Transaction,
    nftOrder: NftBulkOrder,
  ) => {
    if (!nftOrder.price) {
      return { ...nftOrder, targetAddress: '' };
    }

    const nftDocRef = database().doc(COL.NFT, nftOrder.nft);
    const nft = <Nft>await this.transaction.get(nftDocRef);

    const collectionDocRef = database().doc(COL.COLLECTION, nft.collection);
    const collection = <Collection>await collectionDocRef.get();

    const spaceDocRef = database().doc(COL.SPACE, nft.space);
    const space = <Space>await spaceDocRef.get();

    let errorCode: number | undefined = undefined;
    try {
      await assertNftCanBePurchased(
        space,
        collection,
        nft,
        nftOrder.requestedNft,
        order.member!,
        true,
      );
    } catch (error) {
      errorCode = get(error, 'eCode', 0);
    }

    if (nft.auction) {
      const service = new NftPurchaseService(this.transactionService);
      await service.creditBids(nft.auction);
    }

    const wallet = await WalletService.newWallet(order.network);
    const targetAddress = await wallet.getNewIotaAddressDetails();

    const royaltySpace = await getSpace(collection.royaltiesSpace);

    const nftPurchaseOrderId = getRandomEthAddress();

    this.transactionService.push({
      ref: database().doc(COL.NFT, nft.uid),
      data: { locked: true, lockedBy: order.uid },
      action: Action.U,
    });

    const currentOwner = nft.owner ? await getMember(nft.owner) : space;

    const nftPurchaseOrder = {
      project,
      type: TransactionType.ORDER,
      uid: nftPurchaseOrderId,
      member: order.member!,
      space: space.uid,
      network: order.network,
      payload: {
        type: TransactionPayloadType.NFT_PURCHASE,
        amount: nftOrder.price,
        targetAddress: targetAddress.bech32,
        beneficiary: nft.owner ? Entity.MEMBER : Entity.SPACE,
        beneficiaryUid: nft.owner || collection.space,
        beneficiaryAddress: getAddress(currentOwner, order.network),
        royaltiesFee: collection.royaltiesFee,
        royaltiesSpace: collection.royaltiesSpace || '',
        royaltiesSpaceAddress: getAddress(royaltySpace, order.network),
        expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
        validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
        reconciled: false,
        void: errorCode !== undefined,
        chainReference: null,
        nft: nft.uid,
        collection: collection.uid,
        restrictions: getRestrictions(collection, nft),
      },
      linkedTransactions: [],
    };
    const docRef = database().doc(COL.TRANSACTION, nftPurchaseOrder.uid);
    this.transactionService.push({ ref: docRef, data: nftPurchaseOrder, action: Action.C });

    return { ...nftOrder, targetAddress: targetAddress.bech32, error: errorCode };
  };
}
