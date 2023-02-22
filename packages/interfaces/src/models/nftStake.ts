import { BaseRecord, Timestamp } from './base';
import { StakeType } from './stake';

export interface NftStake extends BaseRecord {
  readonly member: string;
  readonly space: string;
  readonly nft: string;
  readonly collection: string;
  readonly weeks: number;
  readonly expiresAt: Timestamp;
  readonly expirationProcessed: boolean;
  readonly type: StakeType;
}
