import { BaseRecord, EthAddress, FileMetedata, Timestamp, ValidatedAddress } from './base';

interface MemberAwardStat {
  readonly badges: string[];
  readonly completed?: number;
  readonly totalReward?: number;
}

interface MemberSpaceStat {
  readonly uid: string;
  readonly createdOn?: Timestamp;
  readonly updatedOn?: Timestamp;
  readonly isMember?: boolean;

  readonly awardStat?: { [symbol: string]: MemberAwardStat };
  readonly awardsCompleted?: number;
  readonly totalReward?: number;
}

export interface Member extends BaseRecord {
  uid: EthAddress;
  nonce?: string;
  name?: string;
  about?: string;
  currentProfileImage?: FileMetedata;
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
