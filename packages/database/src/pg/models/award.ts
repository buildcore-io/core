/**
 * This file was automatically generated by knex
 * Do not modify this file manually
 */
import * as commons from './common';

export interface PgAwardParticipants extends commons.BaseSubRecord {
  comment?: string;
  completed?: boolean;
  count?: number;
  tokenReward?: number;
}

export interface PgAwardOwners extends commons.BaseSubRecord {}

export interface PgAward extends commons.BaseRecord {
  name?: string;
  description?: string;
  space?: string;
  endDate?: Date;
  issued?: number;
  badgesMinted?: number;
  approved?: boolean;
  rejected?: boolean;
  completed?: boolean;
  network?: string;
  aliasStorageDeposit?: number;
  collectionStorageDeposit?: number;
  nttStorageDeposit?: number;
  nativeTokenStorageDeposit?: number;
  funded?: boolean;
  fundingAddress?: string;
  fundedBy?: string;
  address?: string;
  airdropClaimed?: number;
  aliasBlockId?: string;
  aliasId?: string;
  collectionBlockId?: string;
  collectionId?: string;
  mediaStatus?: string;
  mediaUploadErrorCount?: number;
  isLegacy?: boolean;
  badge_name?: string;
  badge_description?: string;
  badge_total?: number;
  badge_type?: string;
  badge_tokenReward?: number;
  badge_tokenUid?: string;
  badge_tokenId?: string;
  badge_tokenSymbol?: string;
  badge_image?: string;
  badge_ipfsMedia?: string;
  badge_ipfsMetadata?: string;
  badge_ipfsRoot?: string;
  badge_lockTime?: number;
}
