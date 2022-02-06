import { BaseRecord, EthAddress, FileMetedata, IotaAddress } from './base';
export const TRANSACTION_AUTO_EXPIRY_MS = 2 * 60 * 1000;
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
  linkedTransactions: EthAddress[];
  reconciled: boolean;
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
  chainReference: string;
  sourceTransaction: OrderTransaction;
  nft?: EthAddress;
  collection?: EthAddress;
}

export interface BillPaymentTransaction {
  amount: number;
  sourceAddress: IotaAddress;
  targetAddress: IotaAddress;
  reconciled: boolean;
  chainReference: string;
  sourceTransaction: OrderTransaction;
  nft?: EthAddress;
  collection?: EthAddress;
}

export interface CreditPaymentTransaction {
  amount: number;
  sourceAddress: IotaAddress;
  targetAddress: IotaAddress;
  reconciled: boolean;
  chainReference: string;
  sourceTransaction: OrderTransaction;
  nft?: EthAddress;
  collection?: EthAddress;
}

export interface Transaction extends BaseRecord {
  type: TransactionType;
  member?: EthAddress;
  space?: EthAddress;
  void?: true;
  payload: any; // VoteTransaction|BadgeTransaction|OrderTransaction|PaymentTransaction|BillPaymentTransaction|CreditPaymentTransaction;
}
