import { BaseRecord, EthAddress, Timestamp, ValidatedAddress } from './base';

/**
 * Member Award Stats.
 */
interface MemberAwardStat {
  readonly tokenSymbol: string;
  readonly badges: string[];
  readonly completed?: number;
  readonly totalReward?: number;
}

/**
 * Member Space Stats.
 */
interface MemberSpaceStat {
  readonly uid: string;
  readonly createdOn?: Timestamp;
  readonly updatedOn?: Timestamp;
  readonly isMember?: boolean;

  readonly awardStat?: { [tokenUid: string]: MemberAwardStat };
  readonly awardsCompleted?: number;
  readonly totalReward?: number;
}

/**
 * Member record.
 */
export interface Member extends BaseRecord {
  uid: EthAddress;
  nonce?: string;
  name?: string;
  about?: string;
  avatarNft?: string;
  avatar?: string;
  discord?: string;
  twitter?: string;
  github?: string;
  spaces?: { [spaceId: string]: MemberSpaceStat };
  alliances?: string[];
  validatedAddress?: ValidatedAddress;
  prevValidatedAddresses?: string[];
  tokenTradingFeePercentage?: number;
  tokenPurchaseFeePercentage?: number;
  awardsCompleted?: number;
  totalReward?: number;
}
