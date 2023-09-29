import { build5Db } from '@build-5/database';
import {
  Access,
  COL,
  CollectionStatus,
  CollectionType,
  NetworkAddress,
  Nft,
  NftAccess,
  NftAvailable,
  NftStatus,
  Space,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import {
  getCollectionByMintingId,
  getNftByMintingId,
} from '../../utils/collection-minting-utils/nft.utils';
import { getProject, getProjects } from '../../utils/common.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { BaseService, HandlerParams } from './base';

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
        projects: getProjects([], project),
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
        ref: build5Db().doc(`${COL.TRANSACTION}/${mintAlias.uid}`),
        data: mintAlias,
        action: 'set',
      });
      return;
    }

    if (!collectionId) {
      const collection = createMetadataCollection(order.space!);
      const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${collection.uid}`);
      this.transactionService.push({ ref: collectionDocRef, data: collection, action: 'set' });

      const space = await build5Db().doc(`${COL.SPACE}/${order.space}`).get<Space>();
      const mintCollectionOrder = createMintMetadataCollectionOrder(
        order,
        collection.uid,
        aliasId,
        order.uid,
        space?.alias?.address!,
      );
      const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${mintCollectionOrder.uid}`);
      this.transactionService.push({ ref: orderDocRef, data: mintCollectionOrder, action: 'set' });
      return;
    }

    const collection = await getCollectionByMintingId(collectionId);
    const nft = nftId
      ? (await getNftByMintingId(nftId))!
      : createMetadataNft(
          order.member || '',
          order.space || '',
          collection!.uid,
          order.payload.metadata || {},
        );
    if (!nftId) {
      const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
      this.transactionService.push({ ref: nftDocRef, data: nft, action: 'set' });
    }

    const space = await build5Db().doc(`${COL.SPACE}/${order.space}`).get<Space>();

    const mintNftOrder = createMintMetadataNftOrder(
      order,
      nft,
      space?.alias?.address!,
      order.payload.collectionId || '',
      order.uid,
    );
    const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${mintNftOrder.uid}`);
    this.transactionService.push({ ref: orderDocRef, data: mintNftOrder, action: 'set' });
    return;
  };
}

export const createMetadataNft = (
  member: string,
  space: string,
  collection: string,
  metadata: Record<string, unknown>,
) =>
  ({
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
  } as Nft);

export const createMetadataCollection = (space: string) => ({
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
  transaction: Transaction,
  collection: string,
  aliasId: string,
  orderId: string,
  aliasGovAddress: NetworkAddress,
  aliasBlockId = '',
): Transaction => ({
  project: getProject(transaction),
  projects: getProjects([transaction]),
  type: TransactionType.METADATA_NFT,
  uid: getRandomEthAddress(),
  member: transaction.member,
  space: transaction.space,
  network: transaction.network,
  payload: {
    type: TransactionPayloadType.MINT_COLLECTION,
    sourceAddress: transaction.payload.targetAddress,
    targetAddress: transaction.payload.targetAddress,
    collection,
    aliasId,
    aliasBlockId,
    aliasGovAddress,
    orderId,
  },
});

export const createMintMetadataNftOrder = (
  transaction: Transaction,
  nft: Nft,
  aliasGovAddress: NetworkAddress,
  collectionId: string,
  baseOrderId: string,
): Transaction => ({
  project: getProject(transaction),
  projects: getProjects([transaction]),
  type: TransactionType.METADATA_NFT,
  uid: getRandomEthAddress(),
  member: nft.owner,
  space: nft.space,
  network: transaction.network,
  payload: {
    type: nft.mintingData?.nftId
      ? TransactionPayloadType.UPDATE_MINTED_NFT
      : TransactionPayloadType.MINT_NFT,
    sourceAddress: transaction.payload.targetAddress,
    aliasGovAddress,
    targetAddress: transaction.payload.targetAddress,
    aliasId: transaction.payload.aliasId || '',
    collectionId,
    orderId: baseOrderId,
    nft: nft.uid,
    nftId: nft.mintingData?.nftId || '',
  },
});
