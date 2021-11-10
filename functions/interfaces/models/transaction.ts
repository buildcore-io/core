import { BaseRecord } from './base';
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
  awardId: string;
}

export interface Transaction extends BaseRecord {
  type: TransactionType;
  member?: string;
  payload: VoteTransaction|BadgeTransaction;
}
