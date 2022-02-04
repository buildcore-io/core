import { BaseRecord, EthAddress } from "./base";

export enum CollectionType {
  CLASSIC = 0,
  GENERATED = 1,
  SFT = 2
}

export interface DiscountLine {
  xp: number;
  amount: number;
}

export interface Collection extends BaseRecord {
  name: string;
  description: string;
  bannerUrl: string;
  type: CollectionType,
  space: string;
  royaltiesFee: number;
  royaltiesSpace: EthAddress;
  discounts: DiscountLine[];
  total: number;
  sold: number;
  approved: boolean;
  rejected: boolean;
}
