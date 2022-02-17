import { BaseRecord, EthAddress, FileMetedata, IotaAddress, Timestamp } from './base';
export const TRANSACTION_AUTO_EXPIRY_MS = 4 * 60 * 1000;
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
  SPACE_ADDRESS_VALIDATION = "SPACE_ADDRESS_VALIDATION",
  MEMBER_ADDRESS_VALIDATION = "MEMBER_ADDRESS_VALIDATION",
}

export interface VoteTransaction {
  proposalId: string;
  votes: string[];
}

export interface WalletResult {
  createdOn: Timestamp;
  chainReference?: string;
  error?: any;
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
  collection?: EthAddress;
}

export interface PaymentTransaction {
  amount: number;
  sourceAddress: IotaAddress;
  targetAddress: IotaAddress;
  reconciled: boolean;
  void: boolean;
  chainReference: string;
  walletReference: WalletResult;
  sourceTransaction: OrderTransaction;
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
  previusOwnerEntity?: 'space' | 'member',
  previusOwner?: EthAddress,
  chainReference: string;
  walletReference: WalletResult;
  sourceTransaction: OrderTransaction;
  nft?: EthAddress;
  collection?: EthAddress;
}

export interface CreditPaymentTransaction {
  amount: number;
  sourceAddress: IotaAddress;
  targetAddress: IotaAddress;
  reconciled: boolean;
  void: boolean;
  chainReference: string;
  walletReference: WalletResult;
  sourceTransaction: OrderTransaction;
  nft?: EthAddress;
  collection?: EthAddress;
}

export interface Transaction extends BaseRecord {
  type: TransactionType;
  member?: EthAddress;
  space?: EthAddress;
  linkedTransactions: EthAddress[];
  payload: any; // VoteTransaction|BadgeTransaction|OrderTransaction|PaymentTransaction|BillPaymentTransaction|CreditPaymentTransaction;
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
