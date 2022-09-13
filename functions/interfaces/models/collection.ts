import { Access, BaseRecord, EthAddress, Timestamp } from "./base";
import { Network } from "./transaction";

export enum CollectionType {
  CLASSIC = 0,
  GENERATED = 1,
  SFT = 2
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

export enum CollectionStatus {
  PRE_MINTED = 'pre_minted',
  READY_TO_MINT = 'ready_to_mint',
  MINTING = 'minting',
  MINTED = 'minted'
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
}

export interface CollectionMintingData {
  readonly mintingOrderId?: string;
  readonly nftsToMint?: number;
  readonly mintedBy?: string;
  readonly mintedOn?: string;
  readonly address?: string;
  readonly network?: Network;
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
  mintingData?: CollectionMintingData;
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
