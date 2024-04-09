import { BaseRecord, Timestamp } from './base';

export interface SoonSnap extends BaseRecord {
  readonly count: number;
  readonly paidOut: number;
  readonly lastPaidOutOn?: Timestamp;

  readonly ethAddress: string;
  readonly ethAddressVerified: boolean;
}
