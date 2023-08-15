import { BaseRecord, Timestamp } from './base';

/**
 * Stake Type.
 */
export enum StakeType {
  STATIC = 'static',
  DYNAMIC = 'dynamic',
}

/**
 * Stake Record.
 */
export interface Stake extends BaseRecord {
  /**
   * Member UID {@link Member}
   */
  readonly member: string;
  /**
   * Space UID {@link Space}
   */
  readonly space: string;
  /**
   * Token UID {@link Token}
   */
  readonly token: string;
  /**
   * Amount of tokens staked and locked
   */
  readonly amount: number;
  /**
   * Calculated stake value based on amount of tokens X period
   */
  readonly value: number;
  /**
   * Number of weeks token is staked for
   */
  readonly weeks: number;
  /**
   * Expires on.
   */
  readonly expiresAt: Timestamp;
  /**
   * Expiration processed
   *
   * @hidden
   */
  readonly expirationProcessed: boolean;
  /**
   * Transaction order ID {@link Transaction}
   */
  readonly orderId: string;
  /**
   * Bill Payment ID {@link Transaction}
   */
  readonly billPaymentId: string;
  /**
   * Stake Type
   */
  readonly type: StakeType;
  /**
   * Custom metadata recorded with the stake.
   */
  readonly customMetadata?: { [key: string]: string };
}

/**
 * Stake statistics.
 */
export interface StakeStat {
  /**
   * Amount
   */
  readonly amount?: number;
  /**
   * Total Amount
   */
  readonly totalAmount?: number;
  /**
   * value
   */
  readonly value?: number;
  /**
   * Total value
   */
  readonly totalValue?: number;
  /**
   * Total number of members that stake
   */
  readonly stakingMembersCount?: number;
}

/**
 * Stake reward status.
 */
export enum StakeRewardStatus {
  UNPROCESSED = 'unprocessed',
  PROCESSED = 'processed',
  PROCESSED_NO_STAKES = 'processed_no_stakes',
  ERROR = 'error',
  DELETED = 'deleted',
}

/**
 * Stake reward record.
 */
export interface StakeReward extends BaseRecord {
  /**
   * Start date of the reward.
   */
  readonly startDate: Timestamp;
  /**
   * End date of the reward
   */
  readonly endDate: Timestamp;
  /**
   * Token vesting date (until what date it's locked)
   */
  readonly tokenVestingDate: Timestamp;
  /**
   * Amount of tokens to distribute within the period
   */
  readonly tokensToDistribute: number;
  /**
   * Token {@link Token}
   */
  readonly token: string;
  /**
   * Token reward status
   */
  readonly status: StakeRewardStatus;
  /**
   * Total staked in the period.
   */
  readonly totalStaked?: number;
  /**
   * Total airdropped in the period.
   */
  readonly totalAirdropped?: number;
}
