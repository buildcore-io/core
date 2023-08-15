import {
  Access,
  BaseRecord,
  BaseSubCollection,
  EthAddress,
  MediaStatus,
  NftMintingData,
  RankStats,
  Timestamp,
  VoteStats,
} from './base';

/**
 * Collection types.
 */
export enum CollectionType {
  CLASSIC = 0,
  GENERATED = 1,
  SFT = 2,
  METADATA = 3,
}

/**
 * Collection Discount Line.
 */
export interface DiscountLine {
  /**
   * Token UID {@link Token}
   */
  tokenUid?: string;
  /**
   * Token Symbol
   */
  tokenSymbol: string;
  /**
   * Token reward amount
   */
  tokenReward: number;
  /**
   * Discount amount 0 - 1 (0 - 100%)
   */
  amount: number;
}

/**
 * Collection Categories.
 */
export enum Categories {
  COLLECTIBLE = 'COLLECTIBLE',
  PFP = 'PFP',
  PHOTOGRAPHY = 'PHOTOGRAPHY',
  ANIMATION = 'ANIMATION',
  THREE_D = '3D',
  GENERATIVE = 'GENERATIVE',
  SINGLE = 'SINGLE',
  INTERACTIVE = 'INTERACTIVE',
  ABSTRACT = 'ABSTRACT',
  PIXELART = 'PIXELART',
  GAME = 'GAME',
  ART = 'ART',
}

/**
 * Collection Status.
 */
export enum CollectionStatus {
  PRE_MINTED = 'pre_minted',
  MINTING = 'minting',
  MINTED = 'minted',
}

/**
 * Collection Base record.
 */
export interface CollectionBase extends BaseRecord {
  /**
   * Collection name.
   */
  name: string;
  /**
   * Collecton description.
   */
  description: string;
  /**
   * Collection banner URL. This must be link to Build.5 storage.
   */
  bannerUrl: string;
  /**
   * Roaylty fee per space.
   */
  royaltiesFee: number;
  /**
   * Roaylty space {@link Space}
   */
  royaltiesSpace: EthAddress;
  /**
   * Discount lines
   */
  discounts: DiscountLine[];
  /**
   * Total number of NFTs currently deposited within the system.
   */
  total: number;
  /**
   * Stats: Total trades within this collection
   */
  totalTrades: number;
  /**
   * Last traded collection on date
   */
  lastTradedOn: Timestamp | null;
  /**
   * Total sold NFTs from initial sale.
   */
  sold: number;
  /**
   * Link to discord related to this collection.
   */
  discord: string;
  /**
   * URL Link
   */
  url: string;
  /**
   * Twitter Link
   */
  twitter: string;
  /**
   * Approved collection
   */
  approved: boolean;
  /**
   * Rejected collection
   */
  rejected: boolean;
  /**
   * Is this collection limited? If so, no new NFT can be added once approved.
   */
  limitedEdition?: boolean;
  /**
   * IPFS media link CID
   */
  ipfsMedia?: string;
  /**
   * IPFS Metadata link CID
   */
  ipfsMetadata?: string;
  /**
   * IPFS link to root directory that contains both {@link ipfsMedia} & {@link ipfsMetadata}
   */
  ipfsRoot?: string;
}

/**
 * Collection Record.
 */
export interface Collection extends CollectionBase {
  /**
   * Collection Category.
   */
  category: Categories;
  /**
   * Collection Type.
   */
  type: CollectionType;
  /**
   * Access to collection.
   */
  access: Access;
  /**
   * Field used with {@link access} to specify awards uid ({@link Award})
   */
  accessAwards: string[];
  /**
   * Field used with {@link access} to specify collections uid ({@link Collection})
   */
  accessCollections: string[];
  /**
   * Space UID
   */
  space: string;
  /**
   * Date this collection will be available for sale from.
   */
  availableFrom: Timestamp;
  /**
   * TODODOC
   */
  price: number;
  /**
   * Initial price for this collection to be sold at.
   */
  availablePrice: number;
  /**
   * Only one NFT can be purchase within this collection by member.
   */
  onePerMemberOnly: boolean;
  /**
   * Link to placeholder NFT {@link Nft}
   */
  placeholderNft: EthAddress;
  /**
   * Place holder URL to the image. This is used to reduce queries on NFT collection.
   */
  placeholderUrl: string;
  /**
   * Collection Status.
   */
  status?: CollectionStatus;
  /**
   * Collection minting status and details.
   */
  mintingData?: NftMintingData;
  /**
   * Total number of ranks.
   */
  rankCount?: number;
  /**
   * Sum of all ranks
   */
  rankSum?: number;
  /**
   * Rank average.
   */
  rankAvg?: number;
  /**
   * Status of media upload to IFPS.
   */
  mediaStatus?: MediaStatus;
  /**
   * Total number of staked NFTs
   */
  stakedNft?: number;
  /**
   * NFTs available for sale.
   */
  nftsOnSale?: number;
  /**
   * NFTs available for auction.
   */
  nftsOnAuction?: number;
  /**
   * Available NFTs for sale.
   */
  availableNfts?: number;
  /**
   * Cheapest price for NFT available within this collection.
   */
  floorPrice?: number;
  /**
   * Vote stats.
   */
  votes?: VoteStats;
}

/**
 * Unsold Minting Options.
 */
export enum UnsoldMintingOptions {
  BURN_UNSOLD = 'burn_unsold',
  SET_NEW_PRICE = 'set_new_price',
  KEEP_PRICE = 'keep_price',
  TAKE_OWNERSHIP = 'take_ownership',
}

/**
 * Collection Stats.
 */
export interface CollectionStats extends BaseSubCollection {
  readonly votes?: VoteStats;
  readonly ranks?: RankStats;
}
