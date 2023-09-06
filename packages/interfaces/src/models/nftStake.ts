import { BaseRecord, Timestamp } from './base';
import { StakeType } from './stake';

/**
 * NFT Stake record.
 */
export interface NftStake extends BaseRecord {
  /**
   * Member {@link Member}
   */
  readonly member: string;
  /**
   * Space {@link Space}
   */
  readonly space: string;
  /**
   * NFT {@link NFT}
   */
  readonly nft: string;
  /**
   * Collection {@link Collection}
   */
  readonly collection: string;
  /**
   * Number of weeks its staked for.
   */
  readonly weeks: number;
  /**
   * Stake expires on.
   */
  readonly expiresAt: Timestamp;
  /**
   * NFT Stake expiration processed
   *
   * @hidden
   */
  readonly expirationProcessed: boolean;
  /**
   * Stake Type
   */
  readonly type: StakeType;
}
