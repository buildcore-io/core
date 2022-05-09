import { BaseRecord, EthAddress, FileMetedata, IotaAddress, Timestamp } from './base';
export const TRANSACTION_AUTO_EXPIRY_MS = 4 * 60 * 1000;
export const TRANSACTION_MAX_EXPIRY_MS = 3 * 24 * 60 * 60 * 1000;
export enum TransactionType {
  BADGE = "BADGE",
  VOTE = "VOTE",
  PLEDGE = "PLEDGE",
  ORDER = "ORDER",
  PAYMENT = "PAYMENT",
  BILL_PAYMENT = "BILL_PAYMENT",
  CREDIT = "CREDIT"
}

export enum TransactionOrderType {
  NFT_PURCHASE = "NFT_PURCHASE",
  NFT_BID = "NFT_BID",
  SPACE_ADDRESS_VALIDATION = "SPACE_ADDRESS_VALIDATION",
  MEMBER_ADDRESS_VALIDATION = "MEMBER_ADDRESS_VALIDATION",
  TOKEN_PURCHASE = 'TOKEN_PURCHASE',
  TOKEN_AIRDROP = 'TOKEN_AIRDROP',
  TOKEN_BUY = 'TOKEN_BUY'
}

export enum TransactionCreditType {
  TOKEN_PURCHASE = "TOKEN_PURCHASE",
  TOKEN_BUY = 'TOKEN_BUY'
}

export enum TransactionValidationType {
  ADDRESS_AND_AMOUNT,
  ADDRESS
}

export interface VoteTransaction {
  proposalId: string;
  votes: string[];
}

export interface WalletResult {
  createdOn: Timestamp;
  processedOn: Timestamp;
  chainReference?: string | null;
  chainReferences?: string[];
  error?: any | null;
  confirmed: boolean;
  count: number;
}

export interface BadgeTransaction {
  award: string;
  name: string;
  image: FileMetedata,
  description: string;
  xp: number;
}

export interface OrderTransaction {
  amount: number;
  targetAddress: IotaAddress;
  type: TransactionOrderType;
  reconciled: boolean;
  void: boolean;
  nft?: EthAddress;
  beneficiary?: 'space' | 'member',
  beneficiaryUid?: EthAddress,
  beneficiaryAddress?: IotaAddress,
  royaltiesFee?: number;
  royaltiesSpace?: EthAddress;
  royaltiesSpaceAddress?: IotaAddress;
  expiresOn: Timestamp;
  validationType: TransactionValidationType;
  collection?: EthAddress;
  token?: EthAddress
}

export interface PaymentTransaction {
  amount: number;
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

export interface BillPaymentTransaction {
  amount: number;
  sourceAddress: IotaAddress;
  targetAddress: IotaAddress;
  reconciled: boolean;
  void: boolean;
  previousOwnerEntity?: 'space' | 'member',
  previousOwner?: EthAddress,
  ownerEntity?: 'space' | 'member',
  owner?: EthAddress,
  chainReference: string;
  walletReference: WalletResult;
  sourceTransaction: string[];
  nft?: EthAddress;
  royalty: boolean,
  collection?: EthAddress;
  delay: number;
}

export interface CreditPaymentTransaction {
  type?: TransactionCreditType;
  amount: number;
  sourceAddress: IotaAddress;
  targetAddress: IotaAddress;
  reconciled: boolean;
  void: boolean;
  chainReference: string;
  walletReference: WalletResult;
  sourceTransaction: string[];
  nft?: EthAddress;
  collection?: EthAddress;
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
  previousOwnerEntity?: 'space' | 'member';
  previousOwner?: EthAddress;
  ownerEntity?: 'space' | 'member';
  owner?: EthAddress;
  nft?: EthAddress;
  royalty: boolean;
  collection?: EthAddress;
}

export type TransactionPayload = VoteTransaction | BadgeTransaction | OrderTransaction | PaymentTransaction | BillPaymentTransaction | CreditPaymentTransaction | IOTATangleTransaction;

export interface Transaction extends BaseRecord {
  type: TransactionType;
  member?: EthAddress;
  space?: EthAddress;
  linkedTransactions: EthAddress[];
  payload: any; // TransactionPayload
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
