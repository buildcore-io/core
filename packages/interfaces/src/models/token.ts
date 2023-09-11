import {
  Access,
  BaseRecord,
  BaseSubCollection,
  MediaStatus,
  NetworkAddress,
  RankStats,
  Timestamp,
  VoteStats,
} from './base';
import { StakeStat, StakeType } from './stake';
import { Network } from './transaction';

/**
 * Token Allocation.
 */
export interface TokenAllocation {
  /**
   * Title
   */
  readonly title: string;
  /**
   * Percentage
   */
  readonly percentage: number;
  /**
   * Is public sale allocation?
   */
  readonly isPublicSale?: boolean;
}

/**
 * Token Status.
 */
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

/**
 * Token distributuion Type.
 */
export enum TokenDistributionType {
  FIXED = 'fixed',
}

/**
 * Token Minting Data.
 */
interface MintingData {
  /**
   * Minted by UID {@link Member}
   */
  readonly mintedBy?: string;
  /**
   * Minted by {@link member}
   */
  readonly mintedOn?: Timestamp;
  /**
   * Alias block ID
   */
  readonly aliasBlockId?: string;
  /**
   * Alias Id
   */
  readonly aliasId?: string;
  /**
   * Alias storage deposit
   */
  readonly aliasStorageDeposit?: number;
  /**
   * Alias token UID {@link Token}
   */
  readonly tokenId?: string;
  /**
   * Block Id
   */
  readonly blockId?: string;
  /**
   * Foundry storage deposit requirement
   */
  readonly foundryStorageDeposit?: number;
  /**
   * Network {@link Network}
   */
  readonly network?: Network;
  /**
   * TODO TEmporary to fix formating on frontend
   *
   * @hidden
   */
  readonly networkFormat?: Network;
  /**
   * Vault address
   */
  readonly vaultAddress?: string;
  /**
   * Total tokens in the vault
   */
  readonly tokensInVault?: number;
  /**
   * TODODOC
   */
  readonly vaultStorageDeposit?: number;
  /**
   * TODODOC
   */
  readonly guardianStorageDeposit?: number;
  /**
   * TODODOC
   */
  readonly meltedTokens?: number;
  /**
   * TODODOC
   */
  readonly circulatingSupply?: number;
}

/**
 * Token Record.
 */
export interface Token extends BaseRecord {
  /**
   * Token name
   */
  readonly name: string;
  /**
   * Token Symbol
   */
  readonly symbol: string;
  /**
   * Token Title
   */
  readonly title?: string;
  /**
   * Description
   */
  readonly description?: string;
  /**
   * Short Description Title
   */
  readonly shortDescriptionTitle?: string;
  /**
   * Short Description
   */
  readonly shortDescription?: string;
  /**
   * Space UID {@link Space}
   */
  readonly space: string;
  /**
   * Price per token for launchpad
   */
  readonly pricePerToken: number;
  /**
   * Tokens total supply
   */
  readonly totalSupply: number;
  /**
   * Tokens allocation. Used during token launchpad.
   */
  readonly allocations: TokenAllocation[];
  /**
   * Token Launchpad start date
   */
  readonly saleStartDate?: Timestamp;
  /**
   * Token Sale Length
   */
  readonly saleLength?: number;
  /**
   * Token Cool down period.
   */
  readonly coolDownEnd?: Timestamp;
  /**
   * TODODOC
   */
  readonly autoProcessAt100Percent?: boolean;
  /**
   * Token Approved
   */
  readonly approved: boolean;
  /**
   * Token Rejected
   */
  readonly rejected: boolean;
  /**
   * Token is public
   */
  readonly public?: boolean;
  /**
   * Token links
   */
  readonly links: URL[];
  /**
   * Token Icon
   */
  readonly icon?: string;
  /**
   * Token's overview graphics
   */
  readonly overviewGraphics?: string;
  /**
   * Token Status
   */
  readonly status: TokenStatus;
  /**
   * Total token's deposit (launchpad)
   */
  readonly totalDeposit: number;
  /**
   * Total tokens ordered (launchpad)
   */
  readonly tokensOrdered?: number;
  /**
   * Total tokens airdropped
   */
  readonly totalAirdropped: number;
  /**
   * link to T&C
   */
  readonly termsAndConditions: string;
  /**
   * Access to purchase token through launchpad
   */
  readonly access: Access;
  /**
   * Used by {@link access}. Only user with certain badges can buy token.
   */
  readonly accessAwards?: string[];
  /**
   * Used by {@link access}. Only user with certain NFTs can buy token.
   */
  readonly accessCollections?: string[];
  /**
   * IPFS Media CIF
   */
  readonly ipfsMedia?: string;
  /**
   * IPFS Metadata CIF
   */
  readonly ipfsMetadata?: string;
  /**
   * IPFS Root directory
   */
  readonly ipfsRoot?: string;
  /**
   * Token Minting data
   */
  readonly mintingData?: MintingData;
  /**
   * Total rank count
   */
  readonly rankCount?: number;
  /**
   * Rank sum
   */
  readonly rankSum?: number;
  /**
   * Rank Average
   */
  readonly rankAvg?: number;
  /**
   * Token media status
   */
  readonly mediaStatus?: MediaStatus;
  /**
   * Trading disabled for the token
   */
  readonly tradingDisabled?: boolean;
  /**
   * Voting statistics
   */
  readonly votes?: VoteStats;
  /**
   * Number of decimals enabled for this token.
   */
  readonly decimals: number;
}

/**
 * Token Drop status.
 */
export enum TokenDropStatus {
  DEPOSIT_NEEDED = 'deposit_needed',
  UNCLAIMED = 'unclaimed',
  CLAIMED = 'claimed',
}

/**
 * Token Drop record.
 */
export interface TokenDrop extends BaseRecord {
  /**
   * Member UID {@link Member}
   */
  readonly member: string;
  /**
   * Token UID {@link Token}
   */
  readonly token: string;
  /**
   * Award UID {@link Award}
   */
  readonly award?: string;
  /**
   * Token vests on
   */
  readonly vestingAt: Timestamp;
  /**
   * Total amount of token.
   */
  readonly count: number;
  /**
   * Airdrop status
   */
  readonly status: TokenDropStatus;
  /**
   * Order ID to claim token
   */
  readonly orderId?: string;
  /**
   * Bill payment for the claim
   */
  readonly billPaymentId?: string;
  /**
   * TODODOC
   */
  readonly sourceAddress?: string;
  /**
   * TODODOC
   */
  readonly stakeRewardId?: string;
  /**
   * Stake Type
   */
  readonly stakeType?: StakeType;
  /**
   * Is thi base token (ie. Networks base token)
   */
  readonly isBaseToken?: boolean;
}

/**
 * Token distribution sub record.
 */
export interface TokenDistribution extends BaseSubCollection {
  /**
   * TODODOC
   */
  readonly uid?: NetworkAddress;
  /**
   * TODODOC
   */
  readonly totalDeposit?: number;
  /**
   * TODODOC
   */
  readonly totalPaid?: number;
  /**
   * TODODOC
   */
  readonly refundedAmount?: number;
  /**
   * TODODOC
   */
  readonly totalBought?: number;
  /**
   * TODODOC
   */
  readonly reconciled?: boolean;
  /**
   * TODODOC
   */
  readonly billPaymentId?: string;
  /**
   * TODODOC
   */
  readonly creditPaymentId?: string;
  /**
   * TODODOC
   */
  readonly royaltyBillPaymentId?: string;
  /**
   * TODODOC
   */
  readonly tokenClaimed?: number;
  /**
   * TODODOC
   */
  readonly lockedForSale?: number;
  /**
   * TODODOC
   */
  readonly sold?: number;
  /**
   * TODODOC
   */
  readonly totalPurchased?: number;
  /**
   * TODODOC
   */
  readonly tokenOwned?: number;
  /**
   * TODODOC
   */
  readonly createdOn?: Timestamp;
  /**
   * TODODOC
   */
  readonly mintedClaimedOn?: Timestamp;
  /**
   * TODODOC
   */
  readonly mintingTransactions?: string[];
  /**
   * TODODOC
   */
  readonly stakes?: { [key: string]: StakeStat };
  // First key -> dynamic/static
  // Second key -> stake expires at in millis
  // value -> stake value
  readonly stakeExpiry?: { [key: string]: { [key: number]: number } };
  /**
   * TODODOC
   */
  readonly stakeRewards?: number;
  /**
   * TODODOC
   */
  readonly extraStakeRewards?: number;
  /**
   * TODODOC
   */
  readonly totalUnclaimedAirdrop?: number;
  /**
   * TODODOC
   */
  readonly stakeVoteTransactionId?: string;
}

/**
 * Token purchase age.
 */
export enum TokenPurchaseAge {
  IN_24_H = 'in24h',
  IN_48_H = 'in48h',
  IN_7_D = 'in7d',
}

/**
 * Token purchase record.
 */
export interface TokenPurchase extends BaseRecord {
  /**
   * TODODOC
   */
  readonly token: string;
  /**
   * TODODOC
   */
  readonly tokenStatus?: TokenStatus;
  /**
   * TODODOC
   */
  readonly sell: string;
  /**
   * TODODOC
   */
  readonly buy: string;
  /**
   * TODODOC
   */
  readonly count: number;
  /**
   * TODODOC
   */
  readonly price: number;
  /**
   * TODODOC
   */
  readonly triggeredBy: TokenTradeOrderType;
  /**
   * TODODOC
   */
  readonly billPaymentId?: string;
  /**
   * TODODOC
   */
  readonly buyerBillPaymentId?: string;
  /**
   * TODODOC
   */
  readonly royaltyBillPayments?: string[];
  /**
   * TODODOC
   */
  readonly sourceNetwork?: Network;
  /**
   * TODODOC
   */
  readonly targetNetwork?: Network;
  /**
   * TODODOC
   */
  readonly sellerTokenTradingFeePercentage?: number;
  /**
   * TODODOC
   */
  readonly sellerTier?: number;
  /**
   * TODODOC
   */
  readonly age: { [key: string]: boolean };
}

/**
 * Token order type.
 */
export enum TokenTradeOrderType {
  BUY = 'buy',
  SELL = 'sell',
}

/**
 * Token Order status
 */
export enum TokenTradeOrderStatus {
  ACTIVE = 'active',
  SETTLED = 'settled',
  CANCELLED = 'cancelled',
  PARTIALLY_SETTLED_AND_CANCELLED = 'partially_settled_and_cancelled',
  EXPIRED = 'expired',
  CANCELLED_UNFULFILLABLE = 'cancelled_unfulfillable',
  CANCELLED_MINTING_TOKEN = 'cancelled_minting_token',
}

/**
 * Token Trade order record.
 */
export interface TokenTradeOrder extends BaseRecord {
  /**
   * TODODOC
   */
  readonly owner: string;
  readonly token: string;
  /**
   * TODODOC
   */
  readonly tokenStatus?: TokenStatus;
  /**
   * TODODOC
   */
  readonly type: TokenTradeOrderType;
  /**
   * TODODOC
   */
  readonly count: number;
  /**
   * TODODOC
   */
  readonly price: number;
  /**
   * TODODOC
   */
  readonly totalDeposit: number;
  /**
   * TODODOC
   */
  readonly balance: number;
  /**
   * TODODOC
   */
  readonly fulfilled: number;
  /**
   * TODODOC
   */
  readonly status: TokenTradeOrderStatus;
  /**
   * TODODOC
   */
  readonly orderTransactionId?: string;
  /**
   * TODODOC
   */
  readonly paymentTransactionId?: string;
  /**
   * TODODOC
   */
  readonly creditTransactionId?: string;
  /**
   * TODODOC
   */
  readonly expiresAt: Timestamp;
  /**
   * TODODOC
   */
  readonly shouldRetry?: boolean;
  /**
   * TODODOC
   */
  readonly sourceNetwork?: Network;
  /**
   * TODODOC
   */
  readonly targetNetwork?: Network;
}

/**
 * Token Stats sub collection.
 */
export interface TokenStats extends BaseSubCollection {
  /**
   * TODODOC
   */
  readonly volumeTotal: number;
  /**
   * TODODOC
   */
  readonly volume: { [key: string]: number };
  /**
   * TODODOC
   */
  readonly stakes?: { [key: string]: StakeStat };
  /**
   * TODODOC
   */
  readonly votes?: VoteStats;
  /**
   * TODODOC
   */
  readonly ranks?: RankStats;
}
