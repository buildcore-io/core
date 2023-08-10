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
  tokenUid?: string;
  tokenSymbol: string;
  tokenReward: number;
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
  name: string;
  description: string;
  bannerUrl: string;
  royaltiesFee: number;
  royaltiesSpace: EthAddress;
  discounts: DiscountLine[];
  total: number;
  totalTrades: number;
  lastTradedOn: Timestamp | null;
  sold: number;
  discord: string;
  url: string;
  twitter: string;
  approved: boolean;
  rejected: boolean;
  limitedEdition?: boolean;
  ipfsMedia?: string;
  ipfsMetadata?: string;
  ipfsRoot?: string;
}

/**
 * Collection Record.
 */
export interface Collection extends CollectionBase {
  category: Categories;
  type: CollectionType;
  access: Access;
  accessAwards: string[];
  accessCollections: string[];
  space: string;
  availableFrom: Timestamp;
  price: number;
  availablePrice: number;
  onePerMemberOnly: boolean;
  placeholderNft: EthAddress;
  placeholderUrl: string;
  status?: CollectionStatus;
  mintingData?: NftMintingData;

  rankCount?: number;
  rankSum?: number;
  rankAvg?: number;

  mediaStatus?: MediaStatus;

  stakedNft?: number;
  nftsOnSale?: number;
  nftsOnAuction?: number;
  availableNfts?: number;
  floorPrice?: number;

  votes?: VoteStats;
}

/**
 * Generic Collection Record.
 */
export interface SchemaCollection extends CollectionBase {
  category?: Categories;
  type?: CollectionType;
  access?: Access;
  accessAwards?: string[];
  accessCollections?: string[];
  space?: string;
  availableFrom?: Timestamp;
  price?: number;
  onePerMemberOnly?: boolean;
  placeholderNft?: EthAddress;
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
