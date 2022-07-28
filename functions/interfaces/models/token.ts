import { Url } from "url";
import { Access, BaseRecord, BaseSubCollection, EthAddress, Timestamp } from "./base";
import { Network } from "./transaction";


export interface TokenAllocation {
  readonly title: string;
  readonly percentage: number;
  readonly isPublicSale?: boolean;
}

export enum TokenStatus {
  AVAILABLE = 'available',
  CANCEL_SALE = 'cancel_sale',
  PROCESSING = 'processing',
  PRE_MINTED = 'pre_minted',
  ERROR = 'error',
  READY_TO_MINT = 'ready_to_mint',
  MINTED = 'minted',
  BASE = 'base'
}

export enum TokenDistributionType {
  FIXED = 'fixed'
}

interface MintingData {
  readonly tokenId?: string;
  readonly mintedBy?: string;
  readonly mintedOn?: Timestamp;
  readonly aliasId?: string;
  readonly blockId?: string;
  readonly network?: Network;
  readonly vaultAddress?: string;
  readonly tokensInVault?: number;
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
  readonly autoProcessAt100Percent?: boolean;
  readonly approved: boolean;
  readonly rejected: boolean;
  readonly public?: boolean;
  readonly links: Url[];
  readonly icon?: string;
  readonly isBaseToken?: boolean;
  readonly overviewGraphics?: string;
  readonly status: TokenStatus;
  readonly totalDeposit: number;
  readonly tokensOrdered?: number;
  readonly totalAirdropped: number;
  readonly termsAndConditions: string;
  readonly access: Access;
  readonly accessAwards?: string[];
  readonly accessCollections?: string[];

  readonly mintingData?: MintingData;
}

export interface TokenDrop {
  readonly vestingAt: Timestamp;
  readonly count: number;
  readonly uid: string;
}

export interface TokenDistribution extends BaseSubCollection {
  readonly uid?: EthAddress;

  readonly totalDeposit?: number;
  readonly totalPaid?: number;
  readonly refundedAmount?: number;
  readonly totalBought?: number;
  readonly reconciled?: boolean;
  readonly billPaymentId?: string;
  readonly creditPaymentId?: string;
  readonly royaltyBillPaymentId?: string;

  readonly tokenDrops?: TokenDrop[];
  readonly tokenClaimed?: number;

  readonly lockedForSale?: number;
  readonly sold?: number;

  readonly totalPurchased?: number;

  readonly tokenOwned?: number;
  readonly createdOn?: Timestamp;

  readonly mintedClaimedOn?: Timestamp;
  readonly mintingTransactions?: string[];
}

export interface TokenPurchase extends BaseRecord {
  readonly token: string;
  readonly sell: string;
  readonly buy: string;
  readonly count: number;
  readonly price: number;
  readonly billPaymentId?: string;
  readonly buyerBillPaymentId?: string;

  readonly sourceNetwork?: Network;
  readonly targetNetwork?: Network;
}

export enum TokenTradeOrderType {
  BUY = 'buy',
  SELL = 'sell'
}

export enum TokenTradeOrderStatus {
  ACTIVE = 'active',
  SETTLED = 'settled',
  CANCELLED = 'cancelled',
  PARTIALLY_SETTLED_AND_CANCELLED = 'partially_settled_and_cancelled',
  EXPIRED = 'expired',
  CANCELLED_UNFULFILLABLE = 'cancelled_unfulfillable',
  CANCELLED_MINTING_TOKEN = 'cancelled_minting_token'
}

export interface TokenTradeOrder extends BaseRecord {
  readonly owner: string;
  readonly token: string;
  readonly type: TokenTradeOrderType;
  readonly count: number;
  readonly price: number;
  readonly totalDeposit: number;
  readonly balance: number;
  readonly fulfilled: number;
  readonly status: TokenTradeOrderStatus;
  readonly orderTransactionId?: string;
  readonly paymentTransactionId?: string;
  readonly creditTransactionId?: string;
  readonly expiresAt: Timestamp;
  readonly shouldRetry?: boolean;

  readonly sourceNetwork?: Network;
  readonly targetNetwork?: Network;
}

export interface TokenStats extends BaseSubCollection {
  readonly volumeTotal: number;
}
