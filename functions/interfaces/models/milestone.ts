import { Base, Timestamp } from './base';

export interface NativeToken {
  readonly id: string;
  readonly amount: string;
}

export interface MilestoneTransactionEntry {
  address: string;
  amount: number;
  nativeTokens?: NativeToken[];
  unlockConditionsCount?: number;
  nftOutput?: any;
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
  milestone: number;
  cmi: number;
  complete: boolean;
  processed: boolean;
}
