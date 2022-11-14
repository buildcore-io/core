import {
  Access,
  BaseRecord,
  BaseSubCollection,
  EthAddress,
  RankStats,
  Timestamp,
  VoteStats,
} from './base';
import { StakeStat } from './stake';
import { Network } from './transaction';

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
  MINTING = 'minting',
  MINTED = 'minted',
  MINTING_ERROR = 'minting_error',
  BASE = 'base',
}

export enum TokenDistributionType {
  FIXED = 'fixed',
}

interface MintingData {
  readonly mintedBy?: string;
  readonly mintedOn?: Timestamp;

  readonly aliasBlockId?: string;
  readonly aliasId?: string;
  readonly aliasStorageDeposit?: number;

  readonly tokenId?: string;
  readonly blockId?: string;
  readonly foundryStorageDeposit?: number;

  readonly network?: Network;

  readonly vaultAddress?: string;
  readonly tokensInVault?: number;

  readonly vaultStorageDeposit?: number;
  readonly guardianStorageDeposit?: number;
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
  readonly links: URL[];
  readonly icon?: string;
  readonly overviewGraphics?: string;
  readonly status: TokenStatus;
  readonly totalDeposit: number;
  readonly tokensOrdered?: number;
  readonly totalAirdropped: number;
  readonly termsAndConditions: string;
  readonly access: Access;
  readonly accessAwards?: string[];
  readonly accessCollections?: string[];
  readonly ipfsMedia?: string;
  readonly ipfsMetadata?: string;

  readonly mintingData?: MintingData;

  readonly rankCount?: number;
  readonly rankSum?: number;
}

export interface TokenDrop {
  readonly orderId?: string;
  readonly sourceAddress?: string;
  readonly vestingAt: Timestamp;
  readonly count: number;
  readonly uid: string;
  readonly spdrId?: string;
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

  readonly stakes?: { [key: string]: StakeStat };
}

export interface TokenPurchase extends BaseRecord {
  readonly token: string;
  readonly tokenStatus?: TokenStatus;
  readonly sell: string;
  readonly buy: string;
  readonly count: number;
  readonly price: number;
  readonly triggeredBy: TokenTradeOrderType;
  readonly billPaymentId?: string;
  readonly buyerBillPaymentId?: string;
  readonly royaltyBillPayments?: string[];

  readonly sourceNetwork?: Network;
  readonly targetNetwork?: Network;
}

export enum TokenTradeOrderType {
  BUY = 'buy',
  SELL = 'sell',
}

export enum TokenTradeOrderStatus {
  ACTIVE = 'active',
  SETTLED = 'settled',
  CANCELLED = 'cancelled',
  PARTIALLY_SETTLED_AND_CANCELLED = 'partially_settled_and_cancelled',
  EXPIRED = 'expired',
  CANCELLED_UNFULFILLABLE = 'cancelled_unfulfillable',
  CANCELLED_MINTING_TOKEN = 'cancelled_minting_token',
}

export interface TokenTradeOrder extends BaseRecord {
  readonly owner: string;
  readonly token: string;
  readonly tokenStatus?: TokenStatus;
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
  readonly stakes?: { [key: string]: StakeStat };
  readonly votes?: VoteStats;
  readonly ranks?: RankStats;
}
