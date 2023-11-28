import { ITransaction, build5Db, build5Storage } from '@build-5/database';
import {
  Access,
  Award,
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
  WenError,
} from '@build-5/interfaces';
import { NftOutput } from '@iota/sdk';
import { head, isEmpty, set } from 'lodash';
import { getNftByMintingId } from '../../../utils/collection-minting-utils/nft.utils';
import { getProject } from '../../../utils/common.utils';
import { getBucket } from '../../../utils/config.utils';
import { serverTime } from '../../../utils/dateTime.utils';
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
import { TransactionMatch } from '../transaction-service';

export class NftDepositService extends BaseService {
  public handleRequest = async ({ order, match, tranEntry }: HandlerParams) => {
    try {
      const nft = await this.depositNft(order, tranEntry, match);
      await this.transactionService.createPayment(order, match);
      this.transactionService.markAsReconciled(order, match.msgId);

      const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
      this.transactionService.push({
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
      return await this.depositNftMintedOutsideBuild5(
        order,
        match.msgId,
        transactionEntry.nftOutput!,
      );
    }
    return await this.depositNftMintedOnBuild5(nft, order, transactionEntry.nftOutput, match);
  };

  private depositNftMintedOnBuild5 = async (
    nft: Nft,
    order: Transaction,
    nftOutput: NftOutput,
    match: TransactionMatch,
  ) => {
    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${nft.collection}`);
    const collection = <Collection>await this.transactionService.get(collectionDocRef);

    if (!collection.approved) {
      throw WenError.collection_must_be_approved;
    }

    const data = {
      status: NftStatus.MINTED,
      depositData: {
        address: order.payload.targetAddress,
        network: order.network,
        mintedOn: serverTime(),
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
    const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
    this.transactionService.push({ ref: nftDocRef, data, action: 'update' });
    this.transactionService.push({
      ref: build5Db().doc(`${COL.TRANSACTION}/${order.uid}`),
      data: {
        space: nft.space,
        'payload.amount': match.to.amount,
        'payload.nft': nft.uid,
      },
      action: 'update',
    });
    return { ...nft, ...data } as Nft;
  };

  private depositNftMintedOutsideBuild5 = async (
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

    const bucket = build5Storage().bucket(getBucket());
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
        console.warn('Could not get banner url', order.uid, nftOutput.nftId, error);
      }
    }

    const collectionDocRef = build5Db().doc(
      `${COL.COLLECTION}/${(existingCollection || migratedCollection).uid}`,
    );
    this.transactionService.push({
      ref: collectionDocRef,
      data: existingCollection
        ? { total: build5Db().inc(1) }
        : { ...migratedCollection, total: build5Db().inc(1) },
      action: 'set',
      merge: true,
    });

    if (isNewSpace) {
      const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space.uid}`);
      this.transactionService.push({ ref: spaceDocRef, data: space, action: 'set' });
    }

    if (!existingCollection && !isEmpty(metadata.collection.royalties)) {
      const royaltyAddress = Object.keys(metadata.collection.royalties || {})[0];
      const royaltySpace = {
        project: getProject(order),
        uid: royaltyAddress,
        name: 'Royalty space for ' + migratedCollection.name,
        collectionId: migratedCollection.uid,
        claimed: false,
        validatedAddress: { [order.network!]: royaltyAddress },
      };
      const royaltySpaceDocRef = build5Db().doc(`${COL.SPACE}/${royaltySpace.uid}`);
      this.transactionService.push({
        ref: royaltySpaceDocRef,
        data: royaltySpace,
        action: 'set',
        merge: true,
      });
    }

    const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
    this.transactionService.push({ ref: nftDocRef, data: nft, action: 'set' });

    return nft;
  };

  private validateInputAndGetMetadata = async (order: Transaction, nftOutput: NftOutput) => {
    const nftMetadata = getNftOutputMetadata(nftOutput);
    set(nftMetadata, 'collectionId', getIssuerNftId(nftOutput));
    if (!isMetadataIrc27(nftMetadata, nftIrc27Schema)) {
      throw WenError.nft_not_irc27_compilant;
    }

    const wallet = await WalletService.newWallet(order.network);
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

const getCollection = async (transaction: ITransaction, collectionId: string) => {
  const collectionSnap = await build5Db()
    .collection(COL.COLLECTION)
    .where('mintingData.nftId', '==', collectionId)
    .get<Collection>();
  if (collectionSnap.length) {
    const docRef = build5Db().doc(`${COL.COLLECTION}/${collectionSnap[0].uid}`);
    return await transaction.get<Collection>(docRef);
  }

  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${collectionId}`);
  return await transaction.get<Collection>(collectionDocRef);
};

const getSpace = async (
  collection: Collection | undefined,
  collectionName: string,
  collectionId: string,
) => {
  if (collection) {
    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${collection.space}`);
    const space = <Space>await spaceDocRef.get();
    return { space, isNewSpace: false };
  }

  const awardsSnap = await build5Db()
    .collection(COL.AWARD)
    .where('collectionId', '==', collectionId)
    .limit(1)
    .get<Award>();

  if (awardsSnap.length) {
    const award = awardsSnap[0];
    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${award.space}`);
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
