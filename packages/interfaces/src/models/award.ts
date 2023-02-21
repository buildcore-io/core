import { BaseRecord, BaseSubCollection, MediaStatus, Timestamp } from './base';
import { Network } from './transaction';

export interface AwardParticipant extends BaseSubCollection {
  uid: string;
  comment?: string;
  completed: boolean;
  createdOn: Timestamp;
  count: number;
  tokenReward: number;
}

export interface AwardOwner extends BaseSubCollection {
  uid: string;
  createdOn: Timestamp;
}

export enum AwardBadgeType {
  NATIVE = 'native',
  BASE = 'base',
}

export interface AwardBadge {
  readonly name: string;
  readonly description: string;
  readonly total: number;
  readonly type: AwardBadgeType;

  readonly tokenReward: number;
  readonly tokenUid: string;
  readonly tokenId?: string;
  readonly tokenSymbol: string;

  readonly image?: string;
  readonly ipfsMedia?: string;
  readonly ipfsMetadata?: string;
  readonly ipfsRoot?: string;

  readonly lockTime: number;
}

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
