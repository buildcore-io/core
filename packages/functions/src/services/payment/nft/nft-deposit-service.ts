import { INftOutput } from '@iota/iota.js-next';
import {
  Access,
  Categories,
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  MediaStatus,
  MilestoneTransactionEntry,
  Network,
  Nft,
  NftAccess,
  NftAvailable,
  NftStatus,
  PropStats,
  Space,
  Transaction,
  TransactionOrder,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty, set } from 'lodash';
import admin, { inc } from '../../../admin.config';
import { dateToTimestamp } from '../../../utils/dateTime.utils';
import { migrateIpfsMediaToSotrage } from '../../../utils/ipfs.utils';
import {
  collectionIrc27Scheam,
  getAliasId,
  getIssuerNftId,
  getNftOutputMetadata,
  isMetadataIrc27,
  nftIrc27Schema,
} from '../../../utils/nft.output.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { NftWallet } from '../../wallet/NftWallet';
import { SmrWallet } from '../../wallet/SmrWalletService';
import { WalletService } from '../../wallet/wallet';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class NftDepositService {
  constructor(readonly transactionService: TransactionService) {}

  public depositNft = async (
    order: Transaction,
    milestoneTransaction: MilestoneTransactionEntry,
    match: TransactionMatch,
  ) => {
    const payment = this.transactionService.createPayment(order, match);
    const nftId = (milestoneTransaction.nftOutput as INftOutput).nftId;

    const nftsSnap = await admin
      .firestore()
      .collection(COL.NFT)
      .where('mintingData.nftId', '==', nftId)
      .limit(1)
      .get();
    if (!nftsSnap.size) {
      await this.depositNftMintedOutsideSoon(order, payment, match, milestoneTransaction);
      return;
    }

    await this.depositNftMintedOnSoon(
      nftsSnap.docs[0].data() as Nft,
      payment,
      match,
      order,
      milestoneTransaction,
    );
  };

  public depositNftMintedOnSoon = async (
    nft: Nft,
    payment: Transaction,
    match: TransactionMatch,
    order: TransactionOrder,
    milestoneTransaction: MilestoneTransactionEntry,
  ) => {
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`);
    const collection = <Collection>(
      (await this.transactionService.transaction.get(collectionDocRef)).data()
    );

    if (!collection.approved) {
      this.transactionService.createNftCredit(payment, match);
      return;
    }

    await this.transactionService.markAsReconciled(order, match.msgId);
    const data = {
      status: NftStatus.MINTED,
      depositData: {
        address: order.payload.targetAddress,
        network: order.network,
        mintedOn: admin.firestore.FieldValue.serverTimestamp(),
        mintedBy: order.member,
        blockId: match.msgId,
        nftId: (milestoneTransaction.nftOutput as INftOutput).nftId || '',
        storageDeposit: milestoneTransaction.amount,
        mintingOrderId: order.uid,
      },
      hidden: false,
    };
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
    this.transactionService.updates.push({ ref: nftDocRef, data, action: 'update' });
    this.transactionService.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`),
      data: {
        space: nft.space,
        'payload.amount': milestoneTransaction.amount,
        'payload.nft': nft.uid,
      },
      action: 'update',
    });
  };

  public depositNftMintedOutsideSoon = async (
    order: TransactionOrder,
    payment: Transaction,
    match: TransactionMatch,
    tranEntry: MilestoneTransactionEntry,
  ) => {
    const metadata = await this.validateInputAndGetMetadata(order, payment, match, tranEntry);
    if (!metadata) {
      return;
    }

    const existingCollection = await getCollection(
      this.transactionService.transaction,
      metadata.nft.collectionId,
    );
    const space = createSpace(
      existingCollection,
      metadata.collection.name as string,
      metadata.nft.collectionId as string,
    );
    const migratedCollection = getMigratedCollection(
      order.network!,
      existingCollection,
      space,
      metadata.nft,
      metadata.collection,
      metadata.aliasId,
    );

    const nft: Nft = {
      uid: (tranEntry.nftOutput as INftOutput).nftId,
      ipfsMedia: (metadata.nft.uri as string).replace('ipfs://', ''),
      name: metadata.nft.name,
      description: metadata.nft.description,
      collection: migratedCollection.uid,
      space: space.uid,
      owner: order.member,
      isOwned: true,
      mintingData: {
        network: order.network,
        nftId: (tranEntry.nftOutput as INftOutput).nftId,
        address: tranEntry.address,
      },
      status: NftStatus.MINTED,
      mediaStatus: MediaStatus.UPLOADED,
      saleAccess: NftAccess.OPEN,
      type: CollectionType.CLASSIC,
      media: '',
      ipfsMetadata: '',
      available: NftAvailable.UNAVAILABLE,
      availableFrom: null,
      price: 0,
      url: '',
      approved: true,
      rejected: false,
      properties: (metadata.nft.attributes || []).reduce(
        (acc: PropStats, attribute: { trait_type: string; value: unknown }) => ({
          ...acc,
          [attribute.trait_type]: {
            label: attribute.trait_type,
            value: attribute.value,
          },
        }),
        {},
      ),
      stats: {},
      placeholderNft: false,
    };

    try {
      const nftMedia = await migrateIpfsMediaToSotrage(COL.NFT, nft.owner!, nft.uid, nft.ipfsMedia);
      set(nft, 'media', nftMedia);
      if (!existingCollection) {
        const bannerUrl = await migrateIpfsMediaToSotrage(
          COL.COLLECTION,
          space.uid,
          migratedCollection.uid,
          migratedCollection.ipfsMedia!,
        );
        set(migratedCollection, 'bannerUrl', bannerUrl);
      }
    } catch (error) {
      this.transactionService.createNftCredit(
        payment,
        match,
        error as { key: string; code: number },
      );
      return;
    }

    if (existingCollection) {
      const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${existingCollection.uid}`);
      this.transactionService.updates.push({
        ref: collectionDocRef,
        data: { total: inc(1) },
        action: 'set',
        merge: true,
      });
    } else {
      const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space.uid}`);
      this.transactionService.updates.push({ ref: spaceDocRef, data: space, action: 'set' });

      if (!isEmpty(metadata.collection.royalties)) {
        const royaltyAddress = Object.keys(metadata.collection.royalties || {})[0];
        const royaltySpace = {
          uid: royaltyAddress,
          name: 'Royalty space for ' + migratedCollection.name,
          collectionId: migratedCollection.uid,
          claimed: false,
          validatedAddress: { [order.network!]: royaltyAddress },
        };
        const royaltySpaceDocRef = admin.firestore().doc(`${COL.SPACE}/${royaltySpace.uid}`);
        this.transactionService.updates.push({
          ref: royaltySpaceDocRef,
          data: royaltySpace,
          action: 'set',
          merge: true,
        });
      }

      const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${migratedCollection.uid}`);
      this.transactionService.updates.push({
        ref: collectionDocRef,
        data: { ...migratedCollection, total: inc(1) },
        action: 'set',
        merge: true,
      });
    }
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
    this.transactionService.updates.push({ ref: nftDocRef, data: nft, action: 'set' });
  };

  private validateInputAndGetMetadata = async (
    order: TransactionOrder,
    payment: Transaction,
    match: TransactionMatch,
    tranEntry: MilestoneTransactionEntry,
  ) => {
    const nftMetadata = getNftOutputMetadata(tranEntry.nftOutput);
    set(nftMetadata, 'collectionId', getIssuerNftId(tranEntry.nftOutput));
    if (!isMetadataIrc27(nftMetadata, nftIrc27Schema)) {
      this.transactionService.createNftCredit(payment, match, WenError.nft_not_irc27_compilant);
      return;
    }

    const wallet = (await WalletService.newWallet(order.network)) as SmrWallet;
    const nftWallet = new NftWallet(wallet);
    const collectionOutput = await nftWallet.getById(nftMetadata.collectionId);
    const collectionMetadata = getNftOutputMetadata(collectionOutput);
    if (!isMetadataIrc27(collectionMetadata, collectionIrc27Scheam)) {
      this.transactionService.createNftCredit(
        payment,
        match,
        WenError.collection_not_irc27_compilant,
      );
      return;
    }

    const aliasId = getAliasId(collectionOutput);
    if (isEmpty(aliasId)) {
      this.transactionService.createNftCredit(
        payment,
        match,
        WenError.collection_was_not_minted_with_alias,
      );
      return;
    }
    return { nft: nftMetadata, collection: collectionMetadata, aliasId };
  };
}

const getCollection = async (transaction: admin.firestore.Transaction, collectionId: string) => {
  const collectionSnap = await admin
    .firestore()
    .collection(COL.COLLECTION)
    .where('mintingData.nftId', '==', collectionId)
    .get();
  if (collectionSnap.size) {
    return <Collection | undefined>(await transaction.get(collectionSnap.docs[0].ref)).data();
  }

  const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collectionId}`);
  return <Collection | undefined>(await transaction.get(collectionDocRef)).data();
};

const createSpace = (
  collection: Collection | undefined,
  collectionName: string,
  collectionId: string,
) =>
  <Space>{
    uid: collection?.space || getRandomEthAddress(),
    name: 'Space for ' + collectionName,
    collectionId,
    claimed: false,
  };

const getMigratedCollection = (
  network: Network,
  collection: Collection | undefined,
  space: Space,
  nftMetadata: Record<string, unknown>,
  collectionMetadata: Record<string, unknown>,
  aliasId: string,
): Collection => {
  if (collection) {
    return collection;
  }
  const [royaltyAddress, royaltiesFee] = Object.entries(collectionMetadata.royalties || {})[0];
  const mintedCollection: Collection = {
    space: space.uid,
    uid: nftMetadata.collectionId as string,
    name: collectionMetadata.name as string,
    description: collectionMetadata.description as string,
    ipfsMedia: (collectionMetadata.uri as string).replace('ipfs://', ''),
    status: CollectionStatus.MINTED,
    mintingData: {
      network: network,
      nftId: nftMetadata.collectionId as string,
      aliasId: aliasId,
    },
    mediaStatus: MediaStatus.UPLOADED,
    category: Categories.COLLECTIBLE,
    type: CollectionType.CLASSIC,
    access: Access.OPEN,
    accessAwards: [],
    accessCollections: [],
    availableFrom: dateToTimestamp(dayjs()),
    price: 0,
    onePerMemberOnly: false,
    placeholderNft: '',
    placeholderUrl: '',
    bannerUrl: '',
    royaltiesFee: royaltiesFee || 0,
    royaltiesSpace: royaltyAddress || '',
    discounts: [],
    total: 1,
    sold: 0,
    discord: '',
    url: '',
    twitter: '',
    approved: true,
    rejected: false,
  };
  return mintedCollection;
};
