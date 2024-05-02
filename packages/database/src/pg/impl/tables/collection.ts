import {
  Access,
  Categories,
  Collection,
  CollectionStatus,
  CollectionType,
  DiscountLine,
  MediaStatus,
  Network,
  UnsoldMintingOptions,
} from '@buildcore/interfaces';
import { get } from 'lodash';
import { ICollection } from '../../interfaces/collection';
import { Converter } from '../../interfaces/common';
import { PgCollection } from '../../models';
import { PgCollectionUpdate } from '../../models/collection_update';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class PgCollectionCollection extends ICollection<
  Collection,
  PgCollection,
  PgCollectionUpdate
> {
  updateFloorPrice = async () => {
    await this.con(this.table).update({
      floorPrice: this.con.raw(`(
        SELECT MIN("availablePrice") 
        FROM nft 
        WHERE collection = collection.uid AND
	            nft."saleAccess" = 0 AND
              available IN (1, 3) 
      )`),
    });
  };
}

export class CollectionConverter implements Converter<Collection, PgCollection> {
  toPg = (collection: Collection): PgCollection => ({
    uid: collection.uid,
    project: collection.project,
    createdOn: collection.createdOn?.toDate(),
    updatedOn: collection.updatedOn?.toDate(),
    createdBy: collection.createdBy,
    name: collection.name,
    description: collection.description,
    bannerUrl: collection.bannerUrl,
    royaltiesFee: collection.royaltiesFee,
    royaltiesSpace: collection.royaltiesSpace,
    total: collection.total,
    totalTrades: collection.totalTrades,
    lastTradedOn: collection.lastTradedOn?.toDate(),
    sold: collection.sold,
    discord: collection.discord,
    url: collection.url,
    twitter: collection.twitter,
    approved: collection.approved,
    rejected: collection.rejected,
    limitedEdition: collection.limitedEdition,
    ipfsMedia: collection.ipfsMedia,
    ipfsMetadata: collection.ipfsMetadata,
    ipfsRoot: collection.ipfsRoot,
    category: collection.category,
    type: collection.type,
    access: collection.access,
    accessAwards: collection.accessAwards,
    accessCollections: collection.accessCollections,
    space: collection.space,
    availableFrom: collection.availableFrom?.toDate(),
    price: collection.price,
    availablePrice: collection.availablePrice,
    onePerMemberOnly: collection.onePerMemberOnly,
    placeholderNft: collection.placeholderNft,
    placeholderUrl: collection.placeholderUrl,
    status: collection.status,
    mintingData_address: collection.mintingData?.address,
    mintingData_network: collection.mintingData?.network,
    mintingData_mintedOn: collection.mintingData?.mintedOn?.toDate(),
    mintingData_mintedBy: collection.mintingData?.mintedBy,
    mintingData_blockId: collection.mintingData?.blockId,
    mintingData_nftId: collection.mintingData?.nftId,
    mintingData_storageDeposit: collection.mintingData?.storageDeposit,
    mintingData_aliasBlockId: collection.mintingData?.aliasBlockId,
    mintingData_aliasId: collection.mintingData?.aliasId,
    mintingData_aliasStorageDeposit: collection.mintingData?.aliasStorageDeposit,
    mintingData_mintingOrderId: collection.mintingData?.mintingOrderId,
    mintingData_nftsToMint: collection.mintingData?.nftsToMint,
    mintingData_nftMediaToUpload: collection.mintingData?.nftMediaToUpload,
    mintingData_nftMediaToPrepare: collection.mintingData?.nftMediaToPrepare,
    mintingData_unsoldMintingOptions: collection.mintingData?.unsoldMintingOptions,
    mintingData_newPrice: collection.mintingData?.newPrice,
    mintingData_nftsStorageDeposit: collection.mintingData?.nftsStorageDeposit,
    rankCount: collection.rankCount,
    rankSum: collection.rankSum,
    rankAvg: collection.rankAvg,
    mediaStatus: collection.mediaStatus,
    mediaUploadErrorCount: collection.mediaUploadErrorCount,
    stakedNft: collection.stakedNft,
    nftsOnSale: collection.nftsOnSale,
    nftsOnAuction: collection.nftsOnAuction,
    availableNfts: collection.availableNfts,
    floorPrice: collection.floorPrice,
    votes_upvotes: collection.votes?.upvotes,
    votes_downvotes: collection.votes?.downvotes,
    votes_voteDiff: collection.votes?.voteDiff,
  });

  fromPg = (pg: PgCollection): Collection =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      createdOn: pgDateToTimestamp(pg.createdOn),
      updatedOn: pgDateToTimestamp(pg.updatedOn),
      createdBy: pg.createdBy,
      name: pg.name || '',
      description: pg.description || '',
      bannerUrl: pg.bannerUrl || '',
      royaltiesFee: pg.royaltiesFee || 0,
      royaltiesSpace: pg.royaltiesSpace,
      discounts: ((pg.discounts as any) || []).map(
        (d: any) =>
          ({
            tokenUid: get(d, 'tokenUid', ''),
            tokenSymbol: get(d, 'tokenSymbol', ''),
            tokenReward: get(d, 'tokenReward', 0),
            amount: get(d, 'amount', 0),
          }) as DiscountLine,
      ),
      total: pg.total || 0,
      totalTrades: pg.totalTrades || 0,
      lastTradedOn: pgDateToTimestamp(pg.lastTradedOn) || null,
      sold: pg.sold || 0,
      discord: pg.discord || '',
      url: pg.url || '',
      twitter: pg.twitter || '',
      approved: pg.approved || false,
      rejected: pg.rejected || false,
      limitedEdition: pg.limitedEdition,
      ipfsMedia: pg.ipfsMedia,
      ipfsMetadata: pg.ipfsMetadata,
      ipfsRoot: pg.ipfsRoot,
      category: (pg.category as Categories)!,
      type: pg.type as CollectionType,
      access: pg.access as Access,
      accessAwards: pg.accessAwards || [],
      accessCollections: pg.accessCollections || [],
      space: pg.space,
      availableFrom: pgDateToTimestamp(pg.availableFrom)!,
      price: pg.price || 0,
      availablePrice: pg.availablePrice || 0,
      onePerMemberOnly: pg.onePerMemberOnly || false,
      placeholderNft: pg.placeholderNft || '',
      placeholderUrl: pg.placeholderUrl || '',
      status: pg.status as CollectionStatus,
      mintingData: {
        address: pg.mintingData_address,
        network: pg.mintingData_network as Network,
        mintedOn: pgDateToTimestamp(pg.mintingData_mintedOn),
        mintedBy: pg.mintingData_mintedBy,
        blockId: pg.mintingData_blockId,
        nftId: pg.mintingData_nftId,
        storageDeposit: pg.mintingData_storageDeposit,
        aliasBlockId: pg.mintingData_aliasBlockId,
        aliasId: pg.mintingData_aliasId,
        aliasStorageDeposit: pg.mintingData_aliasStorageDeposit,
        mintingOrderId: pg.mintingData_mintingOrderId,
        nftsToMint: pg.mintingData_nftsToMint,
        nftMediaToUpload: pg.mintingData_nftMediaToUpload,
        nftMediaToPrepare: pg.mintingData_nftMediaToPrepare,
        unsoldMintingOptions: pg.mintingData_unsoldMintingOptions as UnsoldMintingOptions,
        newPrice: pg.mintingData_newPrice,
        nftsStorageDeposit: pg.mintingData_nftsStorageDeposit,
      },
      rankCount: pg.rankCount,
      rankSum: pg.rankSum,
      rankAvg: pg.rankAvg,
      mediaStatus: pg.mediaStatus as MediaStatus,
      mediaUploadErrorCount: pg.mediaUploadErrorCount,
      stakedNft: pg.stakedNft,
      nftsOnSale: pg.nftsOnSale,
      nftsOnAuction: pg.nftsOnAuction,
      availableNfts: pg.availableNfts,
      floorPrice: pg.floorPrice,
      votes: {
        upvotes: pg.votes_upvotes || 0,
        downvotes: pg.votes_downvotes || 0,
        voteDiff: pg.votes_voteDiff || 0,
      },
    });
}