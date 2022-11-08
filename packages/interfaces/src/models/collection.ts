import {
  Access,
  BaseRecord,
  BaseSubCollection,
  EthAddress,
  NftMintingData,
  Timestamp,
  VoteStats,
} from './base';

export enum CollectionType {
  CLASSIC = 0,
  GENERATED = 1,
  SFT = 2,
}

export interface DiscountLine {
  xp: number;
  amount: number;
}

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

export enum CollectionStatus {
  PRE_MINTED = 'pre_minted',
  MINTING = 'minting',
  MINTED = 'minted',
}

export interface CollectionBase extends BaseRecord {
  name: string;
  description: string;
  bannerUrl: string;
  royaltiesFee: number;
  royaltiesSpace: EthAddress;
  discounts: DiscountLine[];
  total: number;
  sold: number;
  discord: string;
  url: string;
  twitter: string;
  approved: boolean;
  rejected: boolean;
  limitedEdition?: boolean;
  ipfsMedia?: string;
  ipfsMetadata?: string;
}

export interface Collection extends CollectionBase {
  category: Categories;
  type: CollectionType;
  access: Access;
  accessAwards: string[];
  accessCollections: string[];
  space: string;
  availableFrom: Timestamp;
  price: number;
  onePerMemberOnly: boolean;
  placeholderNft: EthAddress;
  placeholderUrl: string;
  status?: CollectionStatus;
  mintingData?: NftMintingData;
}

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

export enum UnsoldMintingOptions {
  BURN_UNSOLD = 'burn_unsold',
  SET_NEW_PRICE = 'set_new_price',
  KEEP_PRICE = 'keep_price',
  TAKE_OWNERSHIP = 'take_ownership',
}

export interface CollectionStats extends BaseSubCollection {
  readonly votes?: VoteStats;
}
