import { BaseRecord, Timestamp } from './base';

export enum StakeType {
  STATIC = 'static',
  DYNAMIC = 'dynamic',
}

export interface Stake extends BaseRecord {
  readonly member: string;
  readonly space: string;
  readonly token: string;
  readonly amount: number;
  readonly value: number;
  readonly weeks: number;
  readonly expiresAt: Timestamp;
  readonly expirationProcessed: boolean;
  readonly orderId: string;
  readonly billPaymentId: string;
  readonly type: StakeType;
  readonly customMetadata?: { [key: string]: string };

  // expiresAt.valueOf
  readonly leftCheck: number;
  // createdOn.valueOf
  readonly rightCheck: number;
}

export interface StakeStat {
  readonly amount?: number;
  readonly totalAmount?: number;
  readonly value?: number;
  readonly totalValue?: number;
  readonly stakingMembersCount?: number;
}

export enum StakeRewardStatus {
  UNPROCESSED = 'unprocessed',
  PROCESSED = 'processed',
  PROCESSED_NO_STAKES = 'processed_no_stakes',
  ERROR = 'error',
}

export interface StakeReward extends BaseRecord {
  readonly startDate: Timestamp;
  readonly endDate: Timestamp;
  readonly tokenVestingDate: Timestamp;

  readonly tokensToDistribute: number;
  readonly token: string;
  readonly status: StakeRewardStatus;

  readonly totalStaked?: number;
  readonly totalAirdropped?: number;

  // startDate.valueOf
  readonly leftCheck: number;
  // endDate.valueOf
  readonly rightCheck: number;
}
