import { BaseRecord, FileMetedata } from './base';
export enum TransactionType {
  BADGE = "BADGE",
  VOTE = "VOTE",
  PLEDGE = "PLEDGE"
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

export interface Transaction extends BaseRecord {
  type: TransactionType;
  member?: string;
  payload: any; // VoteTransaction|BadgeTransaction;
}
