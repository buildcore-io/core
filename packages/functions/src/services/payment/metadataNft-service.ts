import { PgTransaction, build5Db } from '@build-5/database';
import {
  Access,
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  Network,
  NetworkAddress,
  Nft,
  NftAccess,
  NftAvailable,
  NftStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { get } from 'lodash';
import {
  getCollectionByMintingId,
  getNftByMintingId,
} from '../../utils/collection-minting-utils/nft.utils';
import { getProject } from '../../utils/common.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { BaseService, HandlerParams } from './base';
import { Action } from './transaction-service';

export class MetadataNftService extends BaseService {
  public handleRequest = async ({ project, order, match }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);
    this.transactionService.markAsReconciled(order, match.msgId);

    const aliasId = order.payload.aliasId;
    const collectionId = order.payload.collectionId;
    const nftId = order.payload.nftId;

    if (!aliasId) {
      const mintAlias: Transaction = {
        project,
        type: TransactionType.METADATA_NFT,
        uid: getRandomEthAddress(),
        space: order.space,
        member: order.member,
        network: order.network,
        payload: {
          type: TransactionPayloadType.MINT_ALIAS,
          amount: order.payload.aliasOutputAmount || 0,
          sourceAddress: order.payload.targetAddress,
          targetAddress: order.payload.targetAddress,
          sourceTransaction: [payment.uid],
          reconciled: false,
          void: false,
          orderId: order.uid,
          collectionOutputAmount: order.payload.collectionOutputAmount || 0,
        },
      };
      this.transactionService.push({
        ref: build5Db().doc(COL.TRANSACTION, mintAlias.uid),
        data: mintAlias,
        action: Action.C,
      });
      return;
    }

    if (!collectionId) {
      const collection = createMetadataCollection(getProject(order), order.space!);
      const collectionDocRef = build5Db().doc(COL.COLLECTION, collection.uid);
      this.transactionService.push({
        ref: collectionDocRef,
        data: collection as Collection,
        action: Action.C,
      });

      const space = await build5Db().doc(COL.SPACE, order.space!).get();
      const mintCollectionOrder = createMintMetadataCollectionOrder(
        order,
        collection.uid,
        aliasId,
        order.uid,
        space?.alias?.address!,
      );
      const orderDocRef = build5Db().doc(COL.TRANSACTION, mintCollectionOrder.uid);
      this.transactionService.push({
        ref: orderDocRef,
        data: mintCollectionOrder,
        action: Action.C,
      });
      return;
    }

    const collection = await getCollectionByMintingId(collectionId);
    const nft = nftId
      ? (await getNftByMintingId(nftId))!
      : createMetadataNft(
          getProject(order),
          order.member || '',
          order.space || '',
          collection!.uid,
          order.payload.metadata || {},
        );
    if (!nftId) {
      const nftDocRef = build5Db().doc(COL.NFT, nft.uid);
      this.transactionService.push({ ref: nftDocRef, data: nft, action: Action.C });
    }

    const space = await build5Db().doc(COL.SPACE, order.space!).get();

    const mintNftOrder = createMintMetadataNftOrder(
      order,
      nft,
      space?.alias?.address!,
      order.payload.collectionId || '',
      order.uid,
    );
    const orderDocRef = build5Db().doc(COL.TRANSACTION, mintNftOrder.uid);
    this.transactionService.push({ ref: orderDocRef, data: mintNftOrder, action: Action.C });
    return;
  };
}

export const createMetadataNft = (
  project: string,
  member: string,
  space: string,
  collection: string,
  metadata: Record<string, unknown>,
) =>
  ({
    project,
    uid: getRandomEthAddress(),
    name: 'Metadata NFT',
    collection,
    owner: member,
    isOwned: true,
    saleAccess: NftAccess.MEMBERS,
    saleAccessMembers: [member],
    available: NftAvailable.UNAVAILABLE,
    price: 0,
    totalTrades: 0,
    type: CollectionType.METADATA,
    space: space,
    approved: true,
    rejected: false,
    properties: metadata,
    stats: {},
    locked: false,
    sold: true,
    status: NftStatus.PRE_MINTED,
    hidden: true,
  }) as Nft;

export const createMetadataCollection = (project: string, space: string) => ({
  project,
  uid: getRandomEthAddress(),
  name: `Collection for ${space}`,
  total: 1,
  sold: 0,
  approved: true,
  rejected: false,
  type: CollectionType.METADATA,
  access: Access.GUARDIANS_ONLY,
  space,
  status: CollectionStatus.MINTED,
});

export const createMintMetadataCollectionOrder = (
  transaction: Transaction | PgTransaction,
  collection: string,
  aliasId: string,
  orderId: string,
  aliasGovAddress: NetworkAddress,
  aliasBlockId = '',
): Transaction => ({
  project: getProject(transaction),
  type: TransactionType.METADATA_NFT,
  uid: getRandomEthAddress(),
  member: transaction.member,
  space: transaction.space,
  network: get(transaction, 'network') as Network,
  payload: {
    type: TransactionPayloadType.MINT_COLLECTION,
    sourceAddress:
      get(transaction, 'payload.targetAddress') || get(transaction, 'payload_sourceAddress'),
    targetAddress:
      get(transaction, 'payload.targetAddress') || get(transaction, 'payload_targetAddress'),
    collection,
    aliasId,
    aliasBlockId,
    aliasGovAddress,
    orderId,
  },
});

export const createMintMetadataNftOrder = (
  transaction: Transaction | PgTransaction,
  nft: Nft,
  aliasGovAddress: NetworkAddress,
  collectionId: string,
  baseOrderId: string,
): Transaction => ({
  project: getProject(transaction),
  type: TransactionType.METADATA_NFT,
  uid: getRandomEthAddress(),
  member: nft.owner,
  space: nft.space,
  network: transaction.network as Network,
  payload: {
    type: nft.mintingData?.nftId
      ? TransactionPayloadType.UPDATE_MINTED_NFT
      : TransactionPayloadType.MINT_NFT,
    sourceAddress:
      get(transaction, 'payload.targetAddress') || get(transaction, 'payload_targetAddress'),
    aliasGovAddress,
    targetAddress:
      get(transaction, 'payload.targetAddress') || get(transaction, 'payload_targetAddress'),
    aliasId: get(transaction, 'payload.aliasId') || get(transaction, 'payload_aliasId', ''),
    collectionId,
    orderId: baseOrderId,
    nft: nft.uid,
    nftId: nft.mintingData?.nftId || '',
  },
});
