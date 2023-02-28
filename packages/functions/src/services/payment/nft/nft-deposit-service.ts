import { INftOutput } from '@iota/iota.js-next';
import {
  Access,
  Award,
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
import { head, isEmpty, set } from 'lodash';
import admin, { inc } from '../../../admin.config';
import { getNftByMintingId } from '../../../utils/collection-minting-utils/nft.utils';
import { getBucket } from '../../../utils/config.utils';
import { dateToTimestamp, serverTime } from '../../../utils/dateTime.utils';
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

  public handleNftDepositRequest = async (
    order: Transaction,
    milestoneTransaction: MilestoneTransactionEntry,
    match: TransactionMatch,
  ) => {
    try {
      const nft = await this.depositNft(order, milestoneTransaction, match);
      await this.transactionService.createPayment(order, match);
      this.transactionService.markAsReconciled(order, match.msgId);

      const orderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`);
      this.transactionService.updates.push({
        ref: orderDocRef,
        data: { 'payload.nft': nft.uid },
        action: 'update',
      });
    } catch (error) {
      const payment = await this.transactionService.createPayment(order, match, true);
      this.transactionService.createNftCredit(payment, match, error as Record<string, unknown>);
    }
  };

  public depositNft = async (
    order: Transaction,
    transactionEntry: MilestoneTransactionEntry,
    match: TransactionMatch,
  ) => {
    if (!transactionEntry.nftOutput) {
      throw WenError.invalid_params;
    }
    const nft = await getNftByMintingId(transactionEntry.nftOutput.nftId);
    if (!nft) {
      return await this.depositNftMintedOutsideSoon(
        order,
        match.msgId,
        transactionEntry.nftOutput!,
      );
    }
    return await this.depositNftMintedOnSoon(nft, order, transactionEntry.nftOutput!, match);
  };

  private depositNftMintedOnSoon = async (
    nft: Nft,
    order: TransactionOrder,
    nftOutput: INftOutput,
    match: TransactionMatch,
  ) => {
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`);
    const collection = <Collection>(
      (await this.transactionService.transaction.get(collectionDocRef)).data()
    );

    if (!collection.approved) {
      throw WenError.collection_must_be_approved;
    }

    const data = {
      status: NftStatus.MINTED,
      depositData: {
        address: order.payload.targetAddress,
        network: order.network,
        mintedOn: admin.firestore.FieldValue.serverTimestamp(),
        mintedBy: order.member,
        blockId: match.msgId,
        nftId: nftOutput.nftId || '',
        storageDeposit: match.to.amount,
        mintingOrderId: order.uid,
      },
      hidden: false,
      isOwned: true,
      owner: order.member!,
    };
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
    this.transactionService.updates.push({ ref: nftDocRef, data, action: 'update' });
    this.transactionService.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`),
      data: {
        space: nft.space,
        'payload.amount': match.to.amount,
        'payload.nft': nft.uid,
      },
      action: 'update',
    });
    return { ...nft, ...data } as Nft;
  };

  private depositNftMintedOutsideSoon = async (
    order: TransactionOrder,
    blockId: string,
    nftOutput: INftOutput,
  ) => {
    const metadata = await this.validateInputAndGetMetadata(order, nftOutput);

    const existingCollection = await getCollection(
      this.transactionService.transaction,
      metadata.nft.collectionId,
    );
    const { space, isNewSpace } = await getSpace(
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
      uid: nftOutput.nftId,
      ipfsMedia: (metadata.nft.uri as string).replace('ipfs://', ''),
      name: metadata.nft.name,
      description: metadata.nft.description,
      collection: migratedCollection.uid,
      space: space.uid,
      owner: order.member,
      isOwned: true,
      mintingData: {
        network: order.network,
        nftId: nftOutput.nftId,
        storageDeposit: Number(nftOutput.amount),
      },
      depositData: {
        address: order.payload.targetAddress,
        network: order.network,
        mintedOn: dateToTimestamp(dayjs()),
        mintedBy: order.member,
        blockId,
        nftId: nftOutput.nftId,
        storageDeposit: Number(nftOutput.amount),
        mintingOrderId: order.uid,
      },
      status: NftStatus.MINTED,
      mediaStatus: MediaStatus.UPLOADED,
      saleAccess: NftAccess.OPEN,
      type: CollectionType.CLASSIC,
      media: '',
      ipfsMetadata: '',
      available: NftAvailable.UNAVAILABLE,
      availableFrom: null,
      hidden: false,
      price: 0,
      totalTrades: 0,
      lastTradedOn: null,
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

    const bucket = admin.storage().bucket(getBucket());
    const nftMedia = await migrateIpfsMediaToSotrage(
      COL.NFT,
      nft.owner!,
      nft.uid,
      nft.ipfsMedia,
      bucket,
    );
    set(nft, 'media', nftMedia);
    if (!existingCollection && migratedCollection.ipfsMedia) {
      const bannerUrl = await migrateIpfsMediaToSotrage(
        COL.COLLECTION,
        space.uid,
        migratedCollection.uid,
        migratedCollection.ipfsMedia,
        bucket,
      );
      set(migratedCollection, 'bannerUrl', bannerUrl);
      set(space, 'avatarUrl', bannerUrl);
    }

    const collectionDocRef = admin
      .firestore()
      .doc(`${COL.COLLECTION}/${(existingCollection || migratedCollection).uid}`);
    this.transactionService.updates.push({
      ref: collectionDocRef,
      data: existingCollection ? { total: inc(1) } : { ...migratedCollection, total: inc(1) },
      action: 'set',
      merge: true,
    });

    if (isNewSpace) {
      const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space.uid}`);
      this.transactionService.updates.push({ ref: spaceDocRef, data: space, action: 'set' });
    }

    if (!existingCollection && !isEmpty(metadata.collection.royalties)) {
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

    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
    this.transactionService.updates.push({ ref: nftDocRef, data: nft, action: 'set' });

    return nft;
  };

  private validateInputAndGetMetadata = async (order: TransactionOrder, nftOutput: INftOutput) => {
    const nftMetadata = getNftOutputMetadata(nftOutput);
    set(nftMetadata, 'collectionId', getIssuerNftId(nftOutput));
    if (!isMetadataIrc27(nftMetadata, nftIrc27Schema)) {
      throw WenError.nft_not_irc27_compilant;
    }

    const wallet = (await WalletService.newWallet(order.network)) as SmrWallet;
    const nftWallet = new NftWallet(wallet);
    const collectionOutput = await nftWallet.getById(nftMetadata.collectionId);
    const collectionMetadata = getNftOutputMetadata(collectionOutput);
    if (!isMetadataIrc27(collectionMetadata, collectionIrc27Scheam)) {
      throw WenError.collection_not_irc27_compilant;
    }

    return {
      nft: nftMetadata,
      collection: collectionMetadata,
      aliasId: getAliasId(collectionOutput),
    };
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

const getSpace = async (
  collection: Collection | undefined,
  collectionName: string,
  collectionId: string,
) => {
  if (collection) {
    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${collection.space}`);
    const space = <Space>(await spaceDocRef.get()).data();
    return { space, isNewSpace: false };
  }

  const awardsSnap = await admin
    .firestore()
    .collection(COL.AWARD)
    .where('collectionId', '==', collectionId)
    .limit(1)
    .get();

  if (awardsSnap.size) {
    const award = awardsSnap.docs[0].data() as Award;
    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${award.space}`);
    const space = <Space>(await spaceDocRef.get()).data();
    return { space, isNewSpace: false };
  }

  const space = <Space>{
    uid: getRandomEthAddress(),
    name: collectionName,
    about:
      'This is autogenerated space for collection "' +
      collectionName +
      '". Don’t forget to claim this space if you are the original author.',
    collectionId,
    claimed: false,
  };
  return { space, isNewSpace: true };
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
  const royaltyAddress = head(Object.keys(collectionMetadata.royalties || {}));
  const royaltyFee = head(Object.values(collectionMetadata.royalties || {}));

  const ipfsMedia = (collectionMetadata.uri as string) || '';
  const mintedCollection: Collection = {
    space: space.uid,
    uid: nftMetadata.collectionId as string,
    name: collectionMetadata.name as string,
    description: collectionMetadata.description as string,
    ipfsMedia: ipfsMedia.includes('ipfs://') ? ipfsMedia.replace('ipfs://', '') : '',
    status: CollectionStatus.MINTED,
    mintingData: {
      network: network,
      nftId: nftMetadata.collectionId as string,
      aliasId,
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
    royaltiesFee: royaltyFee || 0,
    royaltiesSpace: royaltyAddress || '',
    discounts: [],
    total: 1,
    sold: 0,
    totalTrades: 0,
    lastTradedOn: null,
    discord: '',
    url: '',
    twitter: '',
    approved: true,
    rejected: false,
    createdOn: serverTime(),
  };
  return mintedCollection;
};
