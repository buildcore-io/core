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
  readonly metadata?: { [key: string]: string };
}

export interface StakeStat {
  readonly amount?: number;
  readonly totalAmount?: number;
  readonly value?: number;
  readonly totalValue?: number;
}

export enum SpdrStatus {
  UNPROCESSED = 'unprocessed',
  PROCESSED = 'processed',
  ERROR = 'error',
}

export interface Spdr extends BaseRecord {
  readonly startDate: Timestamp;
  readonly endDate: Timestamp;
  readonly tokenVestingDate: Timestamp;

  readonly tokensToDistribute: number;
  readonly token: string;
  readonly status: SpdrStatus;

  readonly totalStaked?: number;
  readonly totalAirdropped?: number;
}
