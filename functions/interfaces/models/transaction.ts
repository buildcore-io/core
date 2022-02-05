import { BaseRecord, EthAddress, FileMetedata, IotaAddress } from './base';
export enum TransactionType {
  BADGE = "BADGE",
  VOTE = "VOTE",
  PLEDGE = "PLEDGE",
  ORDER = "ORDER",
  PAYMENT = "PAYMENT",
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
}

export interface PaymentTransaction {
  amount: number;
  targetAddress: IotaAddress;
  reconciled: boolean;
  chainReference: string;
  sourceTransaction: OrderTransaction;
}

export interface BillTransaction {
  amount: number;
  targetAddress: IotaAddress;
  reconciled: boolean;
  chainReference: string;
  sourceTransaction: OrderTransaction;
}

export interface CreditTransaction {
  amount: number;
  targetAddress: IotaAddress;
  reconciled: boolean;
  chainReference: string;
  sourceTransaction: OrderTransaction;
}

export interface Transaction extends BaseRecord {
  type: TransactionType;
  member?: EthAddress;
  space?: EthAddress;
  payload: any; // VoteTransaction|BadgeTransaction|OrderTransaction|PaymentTransaction|BillTransaction|CreditTransaction;
}
