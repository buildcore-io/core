import { BaseRecord, Timestamp } from './base';

export interface Stake extends BaseRecord {
  readonly member: string;
  readonly space: string;
  readonly amount: number;
  readonly value: number;
  readonly weeks: number;
  readonly expiresAt: Timestamp;
  readonly expirationProcessed: boolean;
  readonly orderId: string;
}
