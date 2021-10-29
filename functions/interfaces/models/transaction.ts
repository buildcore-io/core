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

export interface Transaction extends BaseRecord {
  type: TransactionType;
  dateTime: Date;
  member?: string;
  payload: VoteTransaction[];
}
