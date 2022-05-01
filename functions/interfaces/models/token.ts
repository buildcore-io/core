import { Url } from "url";
import { BaseRecord, EthAddress, Timestamp } from "./base";


export interface TokenAllocation {
  readonly title: string;
  readonly percentage: number;
  readonly isPublicSale?: boolean;
}

export enum TokenStatus {
  READY = 'ready',
  PROCESSING_PAYMENTS = 'processing_payments',
  ERROR = 'error'
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
  readonly pending: boolean;
  readonly links: Url[];
  readonly icon?: string;
  readonly overviewGraphics?: string;
  readonly status: TokenStatus
}

export interface TokenPurchase {
  readonly member?: EthAddress;
  readonly totalAmount?: number;
  readonly amount?: number;
  readonly refundedAmount?: number;
  readonly tokenOwned?: number;
  readonly reconciled?: boolean;
}
