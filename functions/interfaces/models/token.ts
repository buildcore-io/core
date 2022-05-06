import { Url } from "url";
import { BaseRecord, BaseSubCollection, EthAddress, Timestamp } from "./base";


export interface TokenAllocation {
  readonly title: string;
  readonly percentage: number;
  readonly isPublicSale?: boolean;
}

export enum TokenStatus {
  AVAILABLE = 'available',
  PROCESSING = 'processing',
  PRE_MINTED = 'pre_minted'
}

export interface Token extends BaseRecord {
  readonly name: string;
  readonly symbol: string;
  readonly title?: string;
  readonly description?: string;
  readonly space: string;
  readonly pricePerToken: number;
  readonly totalSupply: number;
  readonly allocations: TokenAllocation[];
  readonly saleStartDate?: Timestamp;
  readonly saleLength?: number;
  readonly coolDownEnd?: Timestamp;
  readonly pending: boolean;
  readonly links: Url[];
  readonly icon?: string;
  readonly overviewGraphics?: string;
  readonly status: TokenStatus;
  readonly totalDeposit: number;
  readonly totalAirdropped: number;
}

export interface TokenDistribution extends BaseSubCollection {
  readonly member?: EthAddress;

  readonly totalDeposit: number;
  readonly totalPaid?: number;
  readonly refundedAmount?: number;
  readonly totalBought?: number;
  readonly reconciled?: boolean;

  readonly tokenDropped?: number;
  readonly tokenClaimed?: number;

  readonly tokenOwned?: number;
}
