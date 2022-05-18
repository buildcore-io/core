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
  PRE_MINTED = 'pre_minted',
  ERROR = ''
}

export enum TokenDistributionType {
  FIXED = 'fixed'
}

export enum TokenAccess {
  OPEN = 0,
  MEMBERS_ONLY = 1,
  GUARDIANS_ONLY = 2,
  MEMBERS_WITH_BADGE = 3,
  MEMBERS_WITH_NFT_FROM_SPACE = 4
}

export interface Token extends BaseRecord {
  readonly name: string;
  readonly symbol: string;
  readonly title?: string;
  readonly description?: string;
  readonly shortDescriptionTitle?: string;
  readonly shortDescription?: string;
  readonly space: string;
  readonly pricePerToken: number;
  readonly totalSupply: number;
  readonly allocations: TokenAllocation[];
  readonly saleStartDate?: Timestamp;
  readonly saleLength?: number;
  readonly coolDownEnd?: Timestamp;
  readonly approved: boolean;
  readonly rejected: boolean;
  readonly links: Url[];
  readonly icon?: string;
  readonly overviewGraphics?: string;
  readonly status: TokenStatus;
  readonly totalDeposit: number;
  readonly totalAirdropped: number;
  readonly termsAndConditions: string;
  readonly access: TokenAccess;
}

export interface TokenDrop {
  readonly vestingAt: Timestamp;
  readonly count: number;
  readonly uid: string;
}

export interface TokenDistribution extends BaseSubCollection {
  readonly uid?: EthAddress;

  readonly totalDeposit: number;
  readonly totalPaid?: number;
  readonly refundedAmount?: number;
  readonly totalBought?: number;
  readonly reconciled?: boolean;
  readonly billPaymentId?: string;
  readonly creditPaymentId?: string;

  readonly tokenDrops?: TokenDrop[];
  readonly tokenClaimed?: number;

  readonly lockedForSale?: number;
  readonly sold?: number;

  readonly totalPurchased?: number;

  readonly tokenOwned?: number;
  readonly createdOn?: Timestamp;
}

export interface TokenPurchase extends BaseRecord {
  readonly token: string;
  readonly sell: string;
  readonly buy: string;
  readonly count: number;
  readonly price: number;
  readonly billPaymentId?: string;
}

export enum TokenBuySellOrderType {
  BUY = 'buy',
  SELL = 'sell'
}

export enum TokenBuySellOrderStatus {
  ACTIVE = 'active',
  SETTLED = 'settled',
  CANCELLED = 'cancelled',
  PARTIALLY_SETTLED_AND_CANCELLED = 'partially_settled_and_cancelled',
  EXPIRED = 'expired'
}

export interface TokenBuySellOrder extends BaseRecord {
  readonly owner: string;
  readonly token: string;
  readonly type: TokenBuySellOrderType;
  readonly count: number;
  readonly price: number;
  readonly fulfilled: number;
  readonly status: TokenBuySellOrderStatus;
  readonly orderTransactionId?: string;
  readonly paymentTransactionId?: string;
  readonly creditTransactionId?: string;
  readonly expiresAt: Timestamp;
}

export interface TokenStats extends BaseSubCollection {
  readonly volumeTotal: number;
}
