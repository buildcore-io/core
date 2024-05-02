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
  createdOn?: Timestamp;
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
  /**
   * Award Name.
   */
  readonly name: string;
  /**
   * Award Description.
   */
  readonly description: string;
  /**
   * Award's space.
   */
  readonly space: string;
  /**
   * Award End date.
   */
  readonly endDate: Timestamp;
  /**
   * Award Badge details {@link AwardBadge}
   */
  readonly badge: AwardBadge;
  /**
   *  Total number of issued badges.
   */
  readonly issued: number;
  /**
   * Total number of minted badges.
   */
  readonly badgesMinted: number;
  /**
   * Is this award approved.
   */
  readonly approved: boolean;
  /**
   * Is this award rejected.
   */
  readonly rejected: boolean;
  /**
   * Is this award completed.
   */
  readonly completed: boolean;
  /**
   * Minted network {@link Network}
   */
  readonly network: Network;
  /**
   * Alias storage deposit requirement.
   */
  readonly aliasStorageDeposit: number;
  /**
   * Collection storage deposit requirement.
   */
  readonly collectionStorageDeposit: number;
  /**
   * NTT (Timelocked NFT) storage deposit requirement.
   */
  readonly nttStorageDeposit: number;
  /**
   * Native token storage deposit requirement.
   */
  readonly nativeTokenStorageDeposit: number;
  /**
   * Was this award funded?
   */
  readonly funded: boolean;
  /**
   * Funded by {@link Member} uid
   */
  readonly fundedBy?: string;
  /**
   * Funding address
   */
  readonly fundingAddress?: string;
  /**
   * TODODOC
   */
  readonly address?: string;
  /**
   * TODODOC
   */
  readonly airdropClaimed?: number;
  /**
   * Alias block ID.
   */
  readonly aliasBlockId?: string;
  /**
   * Alias ID on the network.
   */
  readonly aliasId?: string;
  /**
   * Collection block ID.
   */
  readonly collectionBlockId?: string;
  /**
   * Collection ID on the network.
   */
  readonly collectionId?: string;
  /**
   * Media status {@link MediaStatus}
   */
  readonly mediaStatus?: MediaStatus;
  /**
   * @hidden
   */
  readonly mediaUploadErrorCount?: number;
  /**
   * Is this legacy award?
   * @deprecated
   */
  readonly isLegacy?: boolean;
}
