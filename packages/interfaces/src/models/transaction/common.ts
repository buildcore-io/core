import { BaseRecord, NetworkAddress, Timestamp } from '../base';
import { TransactionPayload } from './payload';

/**
 * Timelimit for ORDER transaction to auto-expire.
 */
export const TRANSACTION_AUTO_EXPIRY_MS = 4 * 60 * 1000;
/**
 * Maximum amount of time any funds can be hold by Soonaverse address.
 */
export const TRANSACTION_MAX_EXPIRY_MS = 31 * 24 * 60 * 60 * 1000;
/**
 * Default auction length time.
 */
export const TRANSACTION_DEFAULT_AUCTION = 3 * 24 * 60 * 60 * 1000;

/**
 * Enum to represent why a transaction was ignored to process
 */
export enum IgnoreWalletReason {
  NONE = '',
  UNREFUNDABLE_DUE_UNLOCK_CONDITIONS = 'UnrefundableDueUnlockConditions',
  UNREFUNDABLE_DUE_TIMELOCK_CONDITION = 'UNREFUNDABLE_DUE_TIMELOCK_CONDITION',
  UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION = 'UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION',
  PRE_MINTED_AIRDROP_CLAIM = 'pre_minted_airdrop_claim',
  EXTRA_STAKE_REWARD = 'EXTRA_STAKE_REWARD',
  MISSING_TARGET_ADDRESS = 'MISSING_TARGET_ADDRESS',
}

/**
 * Enum representing all the possible transactions
 */
export enum TransactionType {
  VOTE = 'VOTE',
  ORDER = 'ORDER',
  PAYMENT = 'PAYMENT',
  BILL_PAYMENT = 'BILL_PAYMENT',

  CREDIT = 'CREDIT',
  CREDIT_TANGLE_REQUEST = 'CREDIT_TANGLE_REQUEST',
  CREDIT_STORAGE_DEPOSIT_LOCKED = 'CREDIT_STORAGE_DEPOSIT_LOCKED',

  MINT_COLLECTION = 'MINT_COLLECTION',
  CREDIT_NFT = 'CREDIT_NFT',
  WITHDRAW_NFT = 'WITHDRAW_NFT',

  MINT_TOKEN = 'MINT_TOKEN',

  AWARD = 'AWARD',

  UNLOCK = 'UNLOCK',

  METADATA_NFT = 'METADATA_NFT',

  STAMP = 'STAMP',

  NFT_TRANSFER = 'NFT_TRANSFER',
}

/**
 * Available DLT networks within BUILD.5
 */
export enum Network {
  IOTA = 'iota',
  /** Only available on wen environment. */
  ATOI = 'atoi',
  SMR = 'smr',
  /** Only available on wen environment. */
  RMS = 'rms',
}

/**
 * Enum representing transaction payload type
 */
export enum TransactionPayloadType {
  NFT_PURCHASE = 'NFT_PURCHASE',
  NFT_PURCHASE_BULK = 'NFT_PURCHASE_BULK',
  NFT_BID = 'NFT_BID',
  AUCTION_BID = 'AUCTION_BID',
  SPACE_ADDRESS_VALIDATION = 'SPACE_ADDRESS_VALIDATION',
  MEMBER_ADDRESS_VALIDATION = 'MEMBER_ADDRESS_VALIDATION',
  TOKEN_PURCHASE = 'TOKEN_PURCHASE',
  TOKEN_AIRDROP = 'TOKEN_AIRDROP',
  MINT_TOKEN = 'MINT_TOKEN',
  CLAIM_MINTED_TOKEN = 'CLAIM_MINTED_TOKEN',
  CLAIM_BASE_TOKEN = 'CLAIM_BASE_TOKEN',
  SELL_TOKEN = 'SELL_TOKEN',
  BUY_TOKEN = 'BUY_TOKEN',
  MINT_COLLECTION = 'MINT_COLLECTION',
  DEPOSIT_NFT = 'DEPOSIT_NFT',
  AIRDROP_MINTED_TOKEN = 'AIRDROP_MINTED_TOKEN',
  CREDIT_LOCKED_FUNDS = 'CREDIT_LOCKED_FUNDS',
  STAKE = 'STAKE',
  TANGLE_REQUEST = 'TANGLE_REQUEST',
  PROPOSAL_VOTE = 'PROPOSAL_VOTE',
  CLAIM_SPACE = 'CLAIM_SPACE',
  STAKE_NFT = 'STAKE_NFT',
  FUND_AWARD = 'FUND_AWARD',
  IMPORT_TOKEN = 'IMPORT_TOKEN',
  MINT_METADATA_NFT = 'MINT_METADATA_NFT',

  MINT_ALIAS = 'MINT_ALIAS',
  BADGE = 'BADGE',
  BURN_ALIAS = 'BURN_ALIAS',

  NONE = '',
  TOKEN_BUY = 'TOKEN_BUY',
  AWARD_COMPLETED = 'AWARD_COMPLETED',
  TOKEN_VAULT_EMPTIED = 'TOKEN_VAULT_EMPTIED',
  TOKEN_TRADE_FULLFILLMENT = 'TOKEN_TRADE_FULLFILLMENT',
  ADDRESS_VALIDATION = 'ADDRESS_VALIDATION',
  TRANSACTION_ALREADY_UNLOCKED = 'TRANSACTION_ALREADY_UNLOCKED',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_PAYMENT = 'INVALID_PAYMENT',
  TOKEN_VOTE = 'TOKEN_VOTE',
  DATA_NO_LONGER_VALID = 'DATA_NO_LONGER_VALID',
  SPACE_CALIMED = 'SPACE_CALIMED',
  PRE_MINTED_CLAIM = 'PRE_MINTED_CLAIM',

  UNLOCK_FUNDS = 'UNLOCK_FUNDS',
  UNLOCK_NFT = 'UNLOCK_NFT',
  TANGLE_TRANSFER = 'TANGLE_TRANSFER',
  TANGLE_TRANSFER_MANY = 'TANGLE_TRANSFER_MANY',

  MINT_NFT = 'MINT_NFT',
  UPDATE_MINTED_NFT = 'UPDATE_MINTED_NFT',

  MINT_NFTS = 'MINT_NFTS',
  LOCK_COLLECTION = 'LOCK_COLLECTION',
  SEND_ALIAS_TO_GUARDIAN = 'SEND_ALIAS_TO_GUARDIAN',

  MINT_FOUNDRY = 'MINT_FOUNDRY',
  MINTED_AIRDROP_CLAIM = 'MINTED_AIRDROP_CLAIM',

  PRE_MINTED_AIRDROP_CLAIM = 'PRE_MINTED_AIRDROP_CLAIM',

  PRE_MINTED_TOKEN_TRADE = 'PRE_MINTED_TOKEN_TRADE',
  MINTED_TOKEN_TRADE = 'MINTED_TOKEN_TRADE',
  BASE_TOKEN_TRADE = 'BASE_TOKEN_TRADE',
  BASE_AIRDROP_CLAIM = 'BASE_AIRDROP_CLAIM',

  STAMP = 'STAMP',

  SWAP = 'SWAP',
}

/**
 * Validation type. Defines when a received amount is processed
 */
export enum TransactionValidationType {
  ADDRESS_AND_AMOUNT = 0,
  ADDRESS = 1,
}

/**
 * Base transaction record
 */
export interface Transaction extends BaseRecord {
  network: Network;
  type: TransactionType;
  isOrderType?: boolean;
  member?: NetworkAddress;
  space?: NetworkAddress;
  shouldRetry?: boolean;
  ignoreWallet?: boolean;
  linkedTransactions?: NetworkAddress[];
  ignoreWalletReason?: IgnoreWalletReason | null;
  payload: TransactionPayload;
}

/**
 * Result after processing a transaction
 */
export interface WalletResult {
  createdOn: Timestamp;
  processedOn: Timestamp;
  chainReference?: string | null;
  chainReferences?: string[];
  error?: unknown | null;
  confirmed: boolean;
  confirmedOn?: Timestamp;
  milestoneTransactionPath?: string;
  count: number;
  inProgress?: boolean;
  nodeIndex?: number;
}

/**
 * Storage return params
 */
export interface StorageReturn {
  readonly amount: number;
  readonly address: NetworkAddress;
}

/**
 * Enum representing the type of the owner or the beneficiary of a transaction
 */
export enum Entity {
  SPACE = 'space',
  MEMBER = 'member',
}

/**
 * Interface representing a tangle payload
 */
export interface IOTATangleTransaction {
  tranId: string;
  network: string;
  payment: boolean;
  ipfsMedia: string;
  ipfsMetadata: string;
  refund: boolean;
  member?: NetworkAddress;
  space?: NetworkAddress;
  previousOwnerEntity?: Entity | null;
  previousOwner?: NetworkAddress | null;
  ownerEntity?: Entity | null;
  owner?: NetworkAddress | null;
  nft?: NetworkAddress;
  token?: NetworkAddress;
  tokenSymbol?: string;
  quantity?: number;
  royalty: boolean;
  collection?: NetworkAddress;
  response?: any;
  invalidPayment?: boolean;
}

/**
 * Enum representing why payment was credited
 */
export enum CreditPaymentReason {
  TRADE_CANCELLED = 'trade_cancelled',
}

/**
 * Function to get the pair of a DLT network
 * @param network
 * @returns
 */
export const getNetworkPair = (network: Network) => {
  switch (network) {
    case Network.IOTA:
      return Network.SMR;
    case Network.ATOI:
      return Network.RMS;
    case Network.SMR:
      return Network.IOTA;
    case Network.RMS:
      return Network.ATOI;
  }
};

/**
 * Detail of each DLT network
 */
export const NETWORK_DETAIL = {
  [Network.IOTA]: {
    label: 'IOTA',
    divideBy: 1000 * 1000,
    decimals: 6,
  },
  [Network.ATOI]: {
    label: 'ATOI',
    divideBy: 1000 * 1000,
    decimals: 6,
  },
  [Network.SMR]: {
    label: Network.SMR.toUpperCase(),
    divideBy: 1000 * 1000,
    decimals: 6,
  },
  [Network.RMS]: {
    label: Network.RMS.toUpperCase(),
    divideBy: 1000 * 1000,
    decimals: 6,
  },
};

/**
 * Default network decimals
 */
export const DEFAULT_NETWORK_DECIMALS = 6;

export const getDefDecimalIfNotSet = (v?: number | null) => {
  return v !== undefined && v !== null && v > -1 ? v : DEFAULT_NETWORK_DECIMALS;
};

export type Units = 'Pi' | 'Ti' | 'Gi' | 'Mi' | 'Ki' | 'i';
