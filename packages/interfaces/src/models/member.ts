import { BaseRecord, NetworkAddress, Timestamp, ValidatedAddress } from './base';

/**
 * Member Award Stats.
 */
interface MemberAwardStat {
  /**
   * Token Symbol.
   */
  readonly tokenSymbol: string;
  /**
   * List of all badges.
   */
  readonly badges: string[];
  /**
   * Total completed awards.
   */
  readonly completed?: number;
  /**
   * Total reward.
   *
   * @deprecated This is not longer used as there might be rewards in various tokens.
   */
  readonly totalReward?: number;
}

/**
 * Member Space Stats.
 */
interface MemberSpaceStat {
  /**
   * Space UID
   */
  readonly uid: string;
  /**
   * Created On - when they joined the space for the first time.
   */
  readonly createdOn?: Timestamp;
  /**
   * Last time it was updated.
   */
  readonly updatedOn?: Timestamp;
  /**
   * Are they still member?
   */
  readonly isMember?: boolean;
  /**
   * Award statistics.
   */
  readonly awardStat?: { [tokenUid: string]: MemberAwardStat };
  /**
   * Total completed awards.
   */
  readonly awardsCompleted?: number;
  /**
   * Total reward.
   *
   * @deprecated This is not longer used as there might be rewards in various tokens.
   */
  readonly totalReward?: number;
}

/**
 * Member record.
 */
export interface Member extends BaseRecord {
  /**
   * Member ID.
   */
  uid: NetworkAddress;
  /**
   * Nonce to sign for authetication purposes.
   */
  nonce?: string;
  /**
   * Member name. Must be unique in the system.
   */
  name?: string;
  /**
   * About member information.
   */
  about?: string;
  /**
   * Link to NFT that's set as profile. Must be minted NFT. {@link NFT}
   */
  avatarNft?: string;
  /**
   * Avatar URL
   */
  avatar?: string;
  /**
   * Discord details.
   */
  discord?: string;
  /**
   * Twitter handle.
   */
  twitter?: string;
  /**
   * Github link.
   */
  github?: string;
  /**
   * Link to spaces member interacted with.
   */
  spaces?: { [spaceId: string]: MemberSpaceStat };
  /**
   * Validated addresses.
   */
  validatedAddress?: ValidatedAddress;
  /**
   * Previouslly validated addresses.
   */
  prevValidatedAddresses?: string[];
  /**
   * Token trading percentage fee. Special config that allows us to overwrite it per member.
   *
   * @hidden
   */
  tokenTradingFeePercentage?: number;
  /**
   * Token purchase fee percentage. Special config that  allows us to overwrite it per member.
   *
   * @hidden
   */
  tokenPurchaseFeePercentage?: number;
  /**
   * Total awards completed
   */
  awardsCompleted?: number;
  /**
   * Total in rewards
   *
   * @depreciated Leagacy code when had just one token. Will be removed.
   */
  totalReward?: number;
}
