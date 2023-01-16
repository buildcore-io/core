import { Base, Timestamp } from './base';

export interface NativeToken {
  readonly id: string;
  readonly amount: string;
}

export interface MilestoneTransactionEntry {
  address: string;
  amount: number;
  nativeTokens?: NativeToken[];
  unlockConditions?: any[];
  nftOutput?: any;
  output?: any;
  outputId?: string;
}

export interface MilestoneTransaction extends Base {
  createdOn: Timestamp;
  messageId: string;
  milestone: number;
  inputs: MilestoneTransactionEntry[];
  outputs: MilestoneTransactionEntry[];
  processed: boolean;
  soonaverseTransactionId?: string;
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
