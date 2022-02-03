import { BaseRecord, EthAddress } from "./base";

export interface DiscountLine {
  xp: number;
  amount: number;
}

export interface Collection extends BaseRecord {
  name: string;
  description: string;
  bannerUrl: string;
  space: string;
  royaltiesFee: number;
  royaltiesSpace: EthAddress;
  discounts: DiscountLine[];
  total: number;
  sold: number;
  approved: boolean;
  rejected: boolean;
}
