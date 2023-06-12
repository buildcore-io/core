import {
  Access,
  COL,
  CollectionStatus,
  CollectionType,
  Network,
  Nft,
  NftAccess,
  NftAvailable,
  NftStatus,
  Space,
  Transaction,
  TransactionMetadataNftType,
  TransactionOrder,
  TransactionType,
} from '@build-5/interfaces';
import { get } from 'lodash';
import { soonDb } from '../../firebase/firestore/soondb';
import {
  getCollectionByMintingId,
  getNftByMintingId,
} from '../../utils/collection-minting-utils/nft.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from './transaction-service';

export class MetadataNftService {
  constructor(readonly transactionService: TransactionService) {}

  public async handleMintMetadataNftRequest(order: TransactionOrder, match: TransactionMatch) {
    const payment = await this.transactionService.createPayment(order, match);
    this.transactionService.markAsReconciled(order, match.msgId);

    const aliasId = get(order, 'payload.aliasId');
    const collectionId = get(order, 'payload.collectionId');
    const nftId = get(order, 'payload.nftId');

    if (!aliasId) {
      const mintAlias = <Transaction>{
        type: TransactionType.METADATA_NFT,
        uid: getRandomEthAddress(),
        space: order.space,
        member: order.member,
        network: order.network,
        payload: {
          type: TransactionMetadataNftType.MINT_ALIAS,
          amount: get(order, 'payload.aliasOutputAmount', 0),
          sourceAddress: order.payload.targetAddress,
          targetAddress: order.payload.targetAddress,
          sourceTransaction: [payment.uid],
          reconciled: false,
          void: false,
          orderId: order.uid,
          collectionOutputAmount: get(order, 'payload.collectionOutputAmount', 0),
        },
      };
      this.transactionService.push({
        ref: soonDb().doc(`${COL.TRANSACTION}/${mintAlias.uid}`),
        data: mintAlias,
        action: 'set',
      });
      return;
    }

    if (!collectionId) {
      const collection = createMetadataCollection(order.space!);
      const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${collection.uid}`);
      this.transactionService.push({ ref: collectionDocRef, data: collection, action: 'set' });

      const space = await soonDb().doc(`${COL.SPACE}/${order.space}`).get<Space>();
      const mintCollectionOrder = createMintMetadataCollectionOrder(
        order,
        collection.uid,
        aliasId,
        order.uid,
        space?.alias?.address!,
      );
      const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${mintCollectionOrder.uid}`);
      this.transactionService.push({ ref: orderDocRef, data: mintCollectionOrder, action: 'set' });
      return;
    }

    const collection = await getCollectionByMintingId(collectionId);
    const nft = nftId
      ? (await getNftByMintingId(nftId))!
      : createMetadataNft(
          get(order, 'member', ''),
          get(order, 'space', ''),
          collection!.uid,
          get(order, 'payload.metadata', {}),
        );
    if (!nftId) {
      const nftDocRef = soonDb().doc(`${COL.NFT}/${nft.uid}`);
      this.transactionService.push({ ref: nftDocRef, data: nft, action: 'set' });
    }

    const space = await soonDb().doc(`${COL.SPACE}/${order.space}`).get<Space>();

    const mintNftOrder = createMintMetadataNftOrder(
      nft,
      order.network!,
      order.payload.targetAddress,
      space?.alias?.address!,
      order.payload.targetAddress,
      get(order, 'payload.aliasId', ''),
      get(order, 'payload.collectionId', ''),
      order.uid,
    );
    const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${mintNftOrder.uid}`);
    this.transactionService.push({ ref: orderDocRef, data: mintNftOrder, action: 'set' });
    return;
  }
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
  aliasGovAddress: string,
  aliasBlockId = '',
) =>
  <Transaction>{
    type: TransactionType.METADATA_NFT,
    uid: getRandomEthAddress(),
    member: transaction.member,
    space: transaction.space,
    network: transaction.network,
    payload: {
      type: TransactionMetadataNftType.MINT_COLLECTION,
      sourceAddress: transaction.payload.targetAddress,
      targetAddress: transaction.payload.targetAddress,
      collection,
      aliasId,
      aliasBlockId,
      aliasGovAddress,
      orderId,
    },
  };

export const createMintMetadataNftOrder = (
  nft: Nft,
  network: Network,
  sourceAddress: string,
  aliasGovAddress: string,
  targetAddress: string,
  aliasId: string,
  collectionId: string,
  baseOrderId: string,
) =>
  <Transaction>{
    type: TransactionType.METADATA_NFT,
    uid: getRandomEthAddress(),
    member: nft.owner,
    space: nft.space,
    network: network,
    payload: {
      type: nft.mintingData?.nftId
        ? TransactionMetadataNftType.UPDATE_MINTED_NFT
        : TransactionMetadataNftType.MINT_NFT,
      sourceAddress,
      aliasGovAddress,
      targetAddress,
      aliasId,
      collectionId,
      orderId: baseOrderId,
      nft: nft.uid,
      nftId: nft.mintingData?.nftId || '',
    },
  };
