import { Base, Timestamp } from './base';

export interface NativeToken {
  readonly id: string;
  readonly amount: string;
}

export interface MilestoneTransactionEntry {
  address: string;
  amount: number;
  nativeTokens?: NativeToken[];
}

export interface MilestoneTransaction extends Base {
  createdOn: Timestamp;
  messageId: string;
  milestone: number;
  inputs: MilestoneTransactionEntry[];
  outputs: MilestoneTransactionEntry[];
  processed: boolean;
}

export interface Milestone {
  transactions: {
    [propName: string]: MilestoneTransaction;
  };
  createdOn: Timestamp;
  cmi: number;
  complete: boolean;
  processed: boolean;
}
