import { BaseRecord, BaseSubCollection, MediaStatus, Timestamp } from './base';
import { Network } from './transaction';

/**
 * Award Participant sub record.
 */
export interface AwardParticipant extends BaseSubCollection {
  /**
   * Member Id
   */
  uid: string;
  /**
   * Comment by the participant upon participation.
   */
  comment?: string | null;
  /**
   * Approved by the Space's Guardian.
   */
  completed: boolean;
  /**
   * Created On.
   */
  createdOn: Timestamp;
  /**
   * Total number of rewards given. Space's Guardian is able to give multiple awards.
   */
  count: number;
  /**
   * Token reward.
   */
  tokenReward: number;
}

/**
 * Award Owner.
 */
export interface AwardOwner extends BaseSubCollection {
  /**
   * Member Id
   */
  uid: string;
  /**
   * Added on.
   */
  createdOn: Timestamp;
}

/**
 * Award Badge Type.
 */
export enum AwardBadgeType {
  NATIVE = 'native',
  BASE = 'base',
}

/**
 * Award Badge record.
 */
export interface AwardBadge {
  /**
   * Award Badge name
   */
  readonly name: string;
  /**
   * Award Badge description
   */
  readonly description: string;
  /**
   * Total available badges to be given.
   */
  readonly total: number;
  /**
   * Award Badge type
   */
  readonly type: AwardBadgeType;
  /**
   * Award Badge token reward.
   */
  readonly tokenReward: number;
  /**
   * Award Badge token uid.
   */
  readonly tokenUid: string;
  /**
   * Award Badge token chain id.
   */
  readonly tokenId?: string;
  /**
   * Award Badge token symbol
   */
  readonly tokenSymbol: string;
  /**
   * Award badge image (used for NFT)
   */
  readonly image?: string;
  /**
   * Award badge IPFS media link
   */
  readonly ipfsMedia?: string;
  /**
   * Award badge IPFS metadata link
   */
  readonly ipfsMetadata?: string;
  /**
   * Award badge IPFS root directory link
   */
  readonly ipfsRoot?: string;
  /**
   * Award badge lock time period (in seconds)
   */
  readonly lockTime: number;
}

/**
 * Award record.
 */
export interface Award extends BaseRecord {
  readonly name: string;
  readonly description: string;
  readonly space: string;
  readonly endDate: Timestamp;
  readonly badge: AwardBadge;
  readonly issued: number;
  readonly badgesMinted: number;
  readonly approved: boolean;
  readonly rejected: boolean;
  readonly completed: boolean;

  readonly network: Network;

  readonly aliasStorageDeposit: number;
  readonly collectionStorageDeposit: number;
  readonly nttStorageDeposit: number;
  readonly nativeTokenStorageDeposit: number;

  readonly funded: boolean;
  readonly fundedBy?: string;
  readonly address?: string;
  readonly airdropClaimed?: number;

  readonly aliasBlockId?: string;
  readonly aliasId?: string;
  readonly collectionBlockId?: string;
  readonly collectionId?: string;

  readonly mediaStatus?: MediaStatus;

  readonly isLegacy?: boolean;
}
