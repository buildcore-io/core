import { BaseRecord, EthAddress, Timestamp } from "./base";

export enum CollectionType {
  CLASSIC = 0,
  GENERATED = 1,
  SFT = 2
}

export enum CollectionAccess {
  OPEN = 0,
  MEMBERS_ONLY = 1,
  GUARDIANS_ONLY = 2,
  MEMBERS_WITH_BADGE = 3,
  MEMBERS_WITH_NFT_FROM_COLLECTION = 4
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
  ART = 'ART'
}

export interface Collection extends BaseRecord {
  name: string;
  description: string;
  bannerUrl: string;
  category: Categories,
  type: CollectionType,
  access: CollectionAccess,
  accessAwards: string[],
  accessCollections: string[],
  space: string;
  royaltiesFee: number;
  royaltiesSpace: EthAddress;
  discounts: DiscountLine[];
  total: number;
  sold: number;
  availableFrom: Timestamp;
  price: number;
  discord: string;
  url: string;
  twitter: string;
  approved: boolean;
  rejected: boolean;
  onePerMemberOnly: boolean;
  placeholderNft?: EthAddress;
}
