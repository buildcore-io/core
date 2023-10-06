import { Base, Timestamp } from './base';

export interface NativeToken {
  readonly id: string;
  readonly amount: bigint;
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
  fromAddresses: string[];
  consumedOutputIds: string[];
  outputs: MilestoneTransactionEntry[];
  processed: boolean;
  build5TransactionId?: string;
}

/**
 * Milestone record.
 */
export interface Milestone {
  transactions: {
    [propName: string]: MilestoneTransaction;
  };
  /**
   * Created on
   */
  createdOn: Timestamp;
  /**
   * Milestone number
   */
  milestone: number;
  /**
   * Cmi number
   */
  cmi: number;
  complete: boolean;
  processed: boolean;
}
