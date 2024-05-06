/**
 * This file was automatically generated by knex
 * Do not modify this file manually
 */
import * as commons from './common';

export interface PgSpaceMembers extends commons.BaseSubRecord {}

export interface PgSpaceKnockingmembers extends commons.BaseSubRecord {}

export interface PgSpaceGuardians extends commons.BaseSubRecord {}

export interface PgSpaceBlockedmembers extends commons.BaseSubRecord {}

export interface PgSpace extends commons.BaseRecord {
  name?: string;
  about?: string;
  open?: boolean;
  tokenBased?: boolean;
  minStakedValue?: number;
  github?: string;
  twitter?: string;
  discord?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  totalGuardians?: number;
  totalMembers?: number;
  totalPendingMembers?: number;
  smrAddress?: string;
  rmsAddress?: string;
  iotaAddress?: string;
  atoiAddress?: string;
  prevValidatedAddresses?: string[];
  vaultAddress?: string;
  collectionId?: string;
  claimed?: boolean;
  ipfsMedia?: string;
  ipfsMetadata?: string;
  ipfsRoot?: string;
  mediaStatus?: string;
  mediaUploadErrorCount?: number;
  alias_address?: string;
  alias_aliasId?: string;
  alias_blockId?: string;
  alias_mintedOn?: Date;
  alias_mintedBy?: string;
}
