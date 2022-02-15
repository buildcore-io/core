import { BaseRecord, EthAddress, Timestamp } from "./base";

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
  INTERAKTIVE = 'INTERAKTIVE',
  ABSTRACT = 'ABSTRACT',
  PIXELART = 'PIXELART',
  ART = 'ART'
}

export interface Collection extends BaseRecord {
  name: string;
  description: string;
  bannerUrl: string;
  category: Categories,
  type: CollectionType,
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
  placeholderNft?: EthAddress;
}
