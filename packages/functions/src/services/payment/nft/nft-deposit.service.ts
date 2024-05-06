import { ITransaction, PgNftUpdate, database, storage } from '@buildcore/database';
import {
  Access,
  COL,
  Categories,
  Collection,
  CollectionStatus,
  CollectionType,
  MediaStatus,
  MilestoneTransactionEntry,
  Nft,
  NftAccess,
  NftAvailable,
  NftStatus,
  PropStats,
  Space,
  Transaction,
  TransactionPayloadType,
  ValidatedAddress,
  WenError,
} from '@buildcore/interfaces';
import { NftOutput } from '@iota/sdk';
import dayjs from 'dayjs';
import { head, isEmpty, set } from 'lodash';
import { getNftByMintingId } from '../../../utils/collection-minting-utils/nft.utils';
import { getProject } from '../../../utils/common.utils';
import { getBucket } from '../../../utils/config.utils';
import { dateToTimestamp, serverTime } from '../../../utils/dateTime.utils';
import { logger } from '../../../utils/logger';
import { migrateUriToSotrage, uriToUrl } from '../../../utils/media.utils';
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
import { WalletService } from '../../wallet/wallet.service';
import { BaseService, HandlerParams } from '../base';
import { Action, TransactionMatch } from '../transaction-service';

export class NftDepositService extends BaseService {
  public handleRequest = async ({ order, match, tranEntry }: HandlerParams) => {
    try {
      const nft = await this.depositNft(order, tranEntry, match);
      await this.transactionService.createPayment(order, match);
      this.transactionService.markAsReconciled(order, match.msgId);

      const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
      this.transactionService.push({
        ref: orderDocRef,
        data: { payload_nft: nft.uid },
        action: Action.U,
      });
    } catch (error) {
      const payment = await this.transactionService.createPayment(order, match, true);
      if (tranEntry.nftOutput) {
        this.transactionService.createNftCredit(payment, match, error as Record<string, unknown>);
      } else {
        this.transactionService.createCredit(TransactionPayloadType.DEPOSIT_NFT, payment, match);
      }
    }
  };

  public depositNft = async (
    order: Transaction,
    transactionEntry: MilestoneTransactionEntry,
    match: TransactionMatch,
  ) => {
    if (!transactionEntry.nftOutput) {
      throw WenError.invalid_nft_id;
    }
    const nft = await getNftByMintingId(transactionEntry.nftOutput.nftId);
    if (!nft) {
      return await this.depositNftMintedOutsideBuildcore(
        order,
        match.msgId,
        transactionEntry.nftOutput!,
      );
    }
    return await this.depositNftMintedOnBuildcore(nft, order, transactionEntry.nftOutput, match);
  };

  private depositNftMintedOnBuildcore = async (
    nft: Nft,
    order: Transaction,
    nftOutput: NftOutput,
    match: TransactionMatch,
  ) => {
    const collectionDocRef = database().doc(COL.COLLECTION, nft.collection);
    const collection = <Collection>await this.transaction.get(collectionDocRef);

    if (!collection.approved) {
      throw WenError.collection_must_be_approved;
    }

    const data: PgNftUpdate = {
      status: NftStatus.MINTED,
      depositData_address: order.payload.targetAddress,
      depositData_network: order.network,
      depositData_mintedOn: dayjs().toDate(),
      depositData_mintedBy: order.member,
      depositData_blockId: match.msgId,
      depositData_nftId: nftOutput.nftId,
      depositData_storageDeposit: match.to.amount,
      depositData_mintingOrderId: order.uid,
      hidden: false,
      isOwned: true,
      owner: order.member,
    };
    const nftDocRef = database().doc(COL.NFT, nft.uid);
    this.transactionService.push({ ref: nftDocRef, data, action: Action.U });
    this.transactionService.push({
      ref: database().doc(COL.TRANSACTION, order.uid),
      data: {
        space: nft.space,
        payload_amount: match.to.amount,
        payload_nft: nft.uid,
      },
      action: Action.U,
    });
    return {
      ...nft,
      status: NftStatus.MINTED,
      depositData: {
        address: order.payload.targetAddress,
        network: order.network,
        mintedOn: dateToTimestamp(dayjs().toDate()),
        mintedBy: order.member,
        blockId: match.msgId,
        nftId: nftOutput.nftId,
        storageDeposit: match.to.amount,
        mintingOrderId: order.uid,
      },
      hidden: false,
      isOwned: true,
      owner: order.member,
    };
  };

  private depositNftMintedOutsideBuildcore = async (
    order: Transaction,
    blockId: string,
    nftOutput: NftOutput,
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
      order,
      existingCollection,
      space,
      metadata.nft,
      metadata.collection,
      metadata.aliasId,
    );

    const nft: Nft = {
      project: getProject(order),
      uid: nftOutput.nftId,
      ipfsMedia: '',
      name: metadata.nft.name,
      description: metadata.nft.description,
      collection: migratedCollection.uid,
      space: space.uid,
      owner: order.member!,
      isOwned: true,
      mintingData: {
        network: order.network,
        nftId: nftOutput.nftId,
        storageDeposit: Number(nftOutput.amount),
      },
      depositData: {
        address: order.payload.targetAddress,
        network: order.network,
        mintedOn: serverTime(),
        mintedBy: order.member!,
        blockId,
        nftId: nftOutput.nftId,
        storageDeposit: Number(nftOutput.amount),
        mintingOrderId: order.uid,
      },
      position: 0,
      status: NftStatus.MINTED,
      mediaStatus: MediaStatus.PENDING_UPLOAD,
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

    const bucket = storage().bucket(getBucket());
    const nftUrl = uriToUrl(metadata.nft.uri);
    const nftMedia = await migrateUriToSotrage(COL.NFT, nft.owner!, nft.uid, nftUrl, bucket);
    set(nft, 'media', nftMedia);

    if (!existingCollection && metadata.collection.uri) {
      try {
        const bannerUrl = await migrateUriToSotrage(
          COL.COLLECTION,
          space.uid,
          migratedCollection.uid,
          uriToUrl(metadata.collection.uri),
          bucket,
        );
        set(migratedCollection, 'bannerUrl', bannerUrl);
        set(migratedCollection, 'mediaStatus', MediaStatus.PENDING_UPLOAD);
        set(space, 'avatarUrl', bannerUrl);
      } catch (error) {
        logger.warn('Could not get banner url warning', order.uid, nftOutput.nftId, error);
      }
    }

    const collectionDocRef = database().doc(
      COL.COLLECTION,
      (existingCollection || migratedCollection).uid,
    );

    this.transactionService.push({
      ref: collectionDocRef,
      data: existingCollection ? { total: database().inc(1) } : migratedCollection,
      action: existingCollection ? Action.U : Action.C,
    });

    if (isNewSpace) {
      const spaceDocRef = database().doc(COL.SPACE, space.uid);
      this.transactionService.push({ ref: spaceDocRef, data: space, action: Action.C });
    }

    if (!existingCollection && !isEmpty(metadata.collection.royalties)) {
      const royaltyAddress = Object.keys(metadata.collection.royalties || {})[0];
      const royaltySpace = {
        project: getProject(order),
        uid: royaltyAddress,
        name: 'Royalty space for ' + migratedCollection.name,
        collectionId: migratedCollection.uid,
        claimed: false,
        validatedAddress: { [order.network!]: royaltyAddress } as unknown as ValidatedAddress,
        createdBy: order.member!,
        totalGuardians: 0,
        totalMembers: 0,
        totalPendingMembers: 0,
        guardians: {},
        members: {},
      };
      const royaltySpaceDocRef = database().doc(COL.SPACE, royaltySpace.uid);
      this.transactionService.push({
        ref: royaltySpaceDocRef,
        data: royaltySpace,
        action: Action.C,
      });
    }

    const nftDocRef = database().doc(COL.NFT, nft.uid);
    this.transactionService.push({ ref: nftDocRef, data: nft, action: Action.C });

    return nft;
  };

  private validateInputAndGetMetadata = async (order: Transaction, nftOutput: NftOutput) => {
    const nftMetadata = isMetadataIrc27(
      { ...getNftOutputMetadata(nftOutput), collectionId: getIssuerNftId(nftOutput) },
      nftIrc27Schema,
    );
    if (!nftMetadata) {
      throw WenError.nft_not_irc27_compilant;
    }

    const wallet = await WalletService.newWallet(order.network);
    const nftWallet = new NftWallet(wallet);
    const collectionOutput = await nftWallet.getById(nftMetadata.collectionId);
    const collectionMetadata = isMetadataIrc27(
      getNftOutputMetadata(collectionOutput),
      collectionIrc27Scheam,
    );
    if (!collectionMetadata) {
      throw WenError.collection_not_irc27_compilant;
    }

    return {
      nft: nftMetadata,
      collection: collectionMetadata,
      aliasId: getAliasId(collectionOutput),
    };
  };
}

const getCollection = async (transaction: ITransaction, collectionId: string) => {
  const collectionSnap = await database()
    .collection(COL.COLLECTION)
    .where('mintingData_nftId', '==', collectionId)
    .get();
  if (collectionSnap.length) {
    const docRef = database().doc(COL.COLLECTION, collectionSnap[0].uid);
    return await transaction.get(docRef);
  }

  const collectionDocRef = database().doc(COL.COLLECTION, collectionId);
  return await transaction.get(collectionDocRef);
};

const getSpace = async (
  collection: Collection | undefined,
  collectionName: string,
  collectionId: string,
) => {
  if (collection) {
    const spaceDocRef = database().doc(COL.SPACE, collection.space!);
    const space = <Space>await spaceDocRef.get();
    return { space, isNewSpace: false };
  }

  const awardsSnap = await database()
    .collection(COL.AWARD)
    .where('collectionId', '==', collectionId)
    .limit(1)
    .get();

  if (awardsSnap.length) {
    const award = awardsSnap[0];
    const spaceDocRef = database().doc(COL.SPACE, award.space);
    const space = <Space>await spaceDocRef.get();
    return { space, isNewSpace: false };
  }

  const space = {
    project: getProject(collection),
    uid: getRandomEthAddress(),
    name: collectionName,
    about:
      'This is autogenerated space for collection "' +
      collectionName +
      '". Don’t forget to claim this space if you are the original author.',
    collectionId,
    claimed: false,
  } as Space;
  return { space, isNewSpace: true };
};

const getMigratedCollection = (
  order: Transaction,
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

  const mintedCollection: Collection = {
    project: getProject(order),
    space: space.uid,
    uid: nftMetadata.collectionId as string,
    name: collectionMetadata.name as string,
    description: collectionMetadata.description as string,
    status: CollectionStatus.MINTED,
    mintingData: {
      network: order.network,
      nftId: nftMetadata.collectionId as string,
      aliasId,
    },
    mediaStatus: MediaStatus.UPLOADED,
    category: Categories.COLLECTIBLE,
    type: CollectionType.CLASSIC,
    access: Access.OPEN,
    accessAwards: [],
    accessCollections: [],
    availableFrom: serverTime(),
    price: 0,
    availablePrice: 0,
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
