import { Base, NetworkAddress, Timestamp } from './base';

export interface NativeToken {
  readonly id: string;
  readonly amount: bigint;
}

export interface MilestoneTransactionEntry {
  address: NetworkAddress;
  amount: number;
  nativeTokens?: NativeToken[];
  unlockConditions?: any[];
  nftOutput?: any;
  output?: any;
  outputId?: string;
  tag?: string;
}

export interface MilestoneTransaction extends Base {
  createdOn: Timestamp;
  messageId: string;
  milestone: number;
  fromAddresses: string[];
  consumedOutputIds: string[];
  outputs: MilestoneTransactionEntry[];
  processed: boolean;
  buildcoreTransactionId?: string;
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
   * Completed on
   */
  completedOn: Timestamp;
  /**
   * Milestone number
   */
  milestone: number;
  /**
   * Cmi number
   */
  cmi: number;
  completed: boolean;
  processed: boolean;
  listenerNodeId: string;
  milestoneTimestamp: Timestamp;
  trxConflictCount: number;
  trxFailedCount: number;
  trxValidCount: number;
}
