import { BaseRecord, EthAddress, FileMetedata, IotaAddress, Timestamp } from './base';
import { NativeToken } from './milestone';

export const TRANSACTION_AUTO_EXPIRY_MS = 4 * 60 * 1000;
export const TRANSACTION_MAX_EXPIRY_MS = 31 * 24 * 60 * 60 * 1000;
export const TRANSACTION_DEFAULT_AUCTION = 3 * 24 * 60 * 60 * 1000;

export enum TransactionType {
  BADGE = 'BADGE',
  VOTE = 'VOTE',
  PLEDGE = 'PLEDGE',
  ORDER = 'ORDER',
  PAYMENT = 'PAYMENT',
  BILL_PAYMENT = 'BILL_PAYMENT',
  CREDIT = 'CREDIT',
  CREDIT_STORAGE_DEPOSIT_LOCKED = 'CREDIT_STORAGE_DEPOSIT_LOCKED',

  MINT_COLLECTION = 'MINT_COLLECTION',
  CREDIT_NFT = 'CREDIT_NFT',
  WITHDRAW_NFT = 'WITHDRAW_NFT',

  MINT_TOKEN = 'MINT_TOKEN',

  UNLOCK = 'UNLOCK',
}

export enum TransactionOrderType {
  NFT_PURCHASE = 'NFT_PURCHASE',
  NFT_BID = 'NFT_BID',
  SPACE_ADDRESS_VALIDATION = 'SPACE_ADDRESS_VALIDATION',
  MEMBER_ADDRESS_VALIDATION = 'MEMBER_ADDRESS_VALIDATION',
  TOKEN_PURCHASE = 'TOKEN_PURCHASE',
  TOKEN_AIRDROP = 'TOKEN_AIRDROP',
  MINT_TOKEN = 'MINT_TOKEN',
  CLAIM_MINTED_TOKEN = 'CLAIM_MINTED_TOKEN',
  SELL_TOKEN = 'SELL_TOKEN',
  BUY_TOKEN = 'BUY_TOKEN',
  MINT_COLLECTION = 'MINT_COLLECTION',
  DEPOSIT_NFT = 'DEPOSIT_NFT',
  AIRDROP_MINTED_TOKEN = 'AIRDROP_MINTED_TOKEN',
  CREDIT_LOCKED_FUNDS = 'CREDIT_LOCKED_FUNDS',
  STAKE = 'STAKE',
}

export enum TransactionMintCollectionType {
  MINT_ALIAS = 'MINT_ALIAS',
  MINT_COLLECTION = 'MINT_COLLECTION',
  MINT_NFTS = 'MINT_NFTS',
  LOCK_COLLECTION = 'LOCK_COLLECTION',
  SEND_ALIAS_TO_GUARDIAN = 'SEND_ALIAS_TO_GUARDIAN',
}

export enum TransactionMintTokenType {
  MINT_ALIAS = 'MINT_ALIAS',
  MINT_FOUNDRY = 'MINT_FOUNDRY',
  SEND_ALIAS_TO_GUARDIAN = 'SEND_ALIAS_TO_GUARDIAN',
}

export enum TransactionCreditType {
  TOKEN_PURCHASE = 'TOKEN_PURCHASE',
  TOKEN_BUY = 'TOKEN_BUY',
}

export enum TransactionUnlockType {
  UNLOCK_FUNDS = 'UNLOCK_FUNDS',
  UNLOCK_NFT = 'UNLOCK_NFT',
}

export enum TransactionValidationType {
  ADDRESS_AND_AMOUNT = 0,
  ADDRESS = 1,
}

export enum TransactionIgnoreWalletReason {
  NONE = '',
  UNREFUNDABLE_DUE_UNLOCK_CONDITIONS = 'UnrefundableDueUnlockConditions',
  UNREFUNDABLE_DUE_TIMELOCK_CONDITION = 'UNREFUNDABLE_DUE_TIMELOCK_CONDITION',
  UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION = 'UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION',
  EXTRA_STAKE_REWARD = 'EXTRA_STAKE_REWARD',
  PRE_MINTED_AIRDROP_CLAIM = 'pre_minted_airdrop_claim',
}

export enum Entity {
  SPACE = 'space',
  MEMBER = 'member',
}

export enum Network {
  IOTA = 'iota',
  ATOI = 'atoi',
  SMR = 'smr',
  RMS = 'rms',
}

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

export interface VoteTransaction {
  proposalId: string;
  votes: string[];
}

export interface WalletResult {
  createdOn: Timestamp;
  processedOn: Timestamp;
  chainReference?: string | null;
  chainReferences?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error?: any | null;
  confirmed: boolean;
  confirmedOn?: Timestamp;
  milestoneTransactionPath?: string;
  count: number;
  inProgress?: boolean;
}

export interface BadgeTransaction {
  award: string;
  name: string;
  image: FileMetedata;
  description: string;
  xp: number;
}

export interface OrderTransaction {
  amount: number;
  nativeTokens?: NativeToken[];
  targetAddress: IotaAddress;
  type: TransactionOrderType;
  reconciled: boolean;
  void: boolean;
  nft?: EthAddress;
  beneficiary?: Entity;
  beneficiaryUid?: EthAddress;
  beneficiaryAddress?: IotaAddress;
  royaltiesFee?: number;
  royaltiesSpace?: EthAddress;
  royaltiesSpaceAddress?: IotaAddress;
  expiresOn: Timestamp;
  validationType: TransactionValidationType;
  collection?: EthAddress;
  token?: EthAddress;
  quantity?: number;
}

export interface PaymentTransaction {
  amount: number;
  nativeTokens?: NativeToken[];
  sourceAddress: IotaAddress;
  targetAddress: IotaAddress;
  reconciled: boolean;
  void: boolean;
  chainReference: string;
  walletReference: WalletResult;
  sourceTransaction: string[];
  nft?: EthAddress;
  collection?: EthAddress;
  invalidPayment: boolean;
}

export interface StorageReturn {
  readonly amount: number;
  readonly address: string;
}

export interface BillPaymentTransaction {
  amount: number;
  storageReturn?: StorageReturn;
  nativeTokens?: NativeToken[];
  vestingAt?: Timestamp;
  sourceAddress: IotaAddress;
  storageDepositSourceAddress?: string;
  targetAddress: IotaAddress;
  reconciled: boolean;
  void: boolean;
  previousOwnerEntity?: Entity;
  previousOwner?: EthAddress;
  ownerEntity?: Entity;
  owner?: EthAddress;
  chainReference: string;
  walletReference: WalletResult;
  sourceTransaction: string[];
  nft?: EthAddress;
  royalty: boolean;
  collection?: EthAddress;
  delay: number;
}

export enum CreditPaymentReason {
  TRADE_CANCELLED = 'trade_cancelled',
}

export interface CreditPaymentTransaction {
  reason?: CreditPaymentReason;
  type?: TransactionCreditType;
  amount: number;
  nativeTokens?: NativeToken[];
  sourceAddress: IotaAddress;
  targetAddress: IotaAddress;
  reconciled: boolean;
  void: boolean;
  chainReference: string;
  walletReference: WalletResult;
  sourceTransaction: string[];
  nft?: EthAddress;
  collection?: EthAddress;
  delay: number;
  dependsOnBillPayment?: boolean;
}

export interface IOTATangleTransaction {
  tranId: string;
  network: string;
  payment: boolean;
  ipfsMedia: string;
  ipfsMetadata: string;
  refund: boolean;
  member?: EthAddress;
  space?: EthAddress;
  previousOwnerEntity?: Entity;
  previousOwner?: EthAddress;
  ownerEntity?: Entity;
  owner?: EthAddress;
  nft?: EthAddress;
  token?: EthAddress;
  quantity?: number;
  royalty: boolean;
  collection?: EthAddress;
}

export type TransactionPayload =
  | VoteTransaction
  | BadgeTransaction
  | OrderTransaction
  | PaymentTransaction
  | BillPaymentTransaction
  | CreditPaymentTransaction
  | IOTATangleTransaction;

export interface Transaction extends BaseRecord {
  network?: Network;
  type: TransactionType;
  isOrderType?: boolean;
  member?: EthAddress;
  space?: EthAddress;
  linkedTransactions: EthAddress[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  shouldRetry?: boolean;
  ignoreWallet?: boolean;
  ignoreWalletReason?: TransactionIgnoreWalletReason;
}

export interface TransactionBillPayment extends Transaction {
  payload: BillPaymentTransaction;
}

export interface TransactionOrder extends Transaction {
  payload: OrderTransaction;
}

export interface TransactionCredit extends Transaction {
  payload: CreditPaymentTransaction;
}

export interface TransactionPayment extends Transaction {
  payload: PaymentTransaction;
}
