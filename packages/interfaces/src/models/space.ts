import {
  BaseRecord,
  BaseSubCollection,
  MediaStatus,
  NetworkAddress,
  Timestamp,
  ValidatedAddress,
} from './base';

/**
 * Space Guardian subcollection.
 */
export interface SpaceGuardian extends BaseSubCollection {
  /**
   * Member ID {@link Member}
   */
  uid: string;
  /**
   * Guardian joined on
   */
  createdOn: Timestamp;
}

/**
 * Space Member subcollection.
 */
export interface SpaceMember extends BaseSubCollection {
  /**
   * Member ID {@link Member}
   */
  uid: string;
  /**
   * Member joined on
   */
  createdOn: Timestamp;
}

/**
 * Space Alias.
 */
export interface Alias {
  /**
   * Address of the alias
   */
  readonly address: NetworkAddress;
  /**
   * Alias ID on the network.
   */
  readonly aliasId: string;
  /**
   * Block id for the {@link aliasId}
   */
  readonly blockId: string;
  /**
   * Alias minted on.
   */
  readonly mintedOn: Timestamp;
  /**
   * Alias minted by.
   */
  readonly mintedBy: string;
}

/**
 * Space record.
 */
export interface Space extends BaseRecord {
  /**
   * Space name.
   */
  name?: string;
  /**
   * Space description.
   */
  about?: string;
  /**
   * Is this open or closed space.
   */
  open?: boolean;
  /**
   * To be member it's based on token.
   */
  tokenBased?: boolean;
  /**
   * Min tokens staked required.
   */
  minStakedValue?: number;
  /**
   * Link to github
   */
  github?: string;
  /**
   * Link to twitter
   */
  twitter?: string;
  /**
   * Link to discord
   */
  discord?: string;
  /**
   * Avatar URL
   */
  avatarUrl?: string;
  /**
   * Banner URL.
   */
  bannerUrl?: string;
  /**
   * Space create by {@link Member}
   */
  createdBy: string;
  /**
   * Stats counter. Total guardians.
   */
  totalGuardians: number;
  /**
   * Stats counter. Total members.
   */
  totalMembers: number;
  /**
   * Stats counter. Total pending members.
   */
  totalPendingMembers: number;
  /**
   * Validated address
   */
  validatedAddress?: ValidatedAddress;
  /**
   * Previouslly Validated addresses
   */
  prevValidatedAddresses?: string[];
  /**
   * Vault address
   */
  vaultAddress?: string;
  guardians: {
    // Owner / from date
    [propName: string]: SpaceGuardian;
  };
  members: {
    // Owner / from date
    [propName: string]: SpaceMember;
  };
  /**
   * Link to collection if this space was created from imported NFT Collection.
   */
  collectionId?: string;
  /**
   * Space has been claimed.
   */
  claimed?: boolean;
  /**
   * IPFS Media CID
   */
  readonly ipfsMedia?: string;
  /**
   * IPFS Metadata CID
   */
  readonly ipfsMetadata?: string;
  /**
   * IPFS Root directory
   */
  readonly ipfsRoot?: string;
  /**
   * Media status
   */
  readonly mediaStatus?: MediaStatus;
  /**
   * Space Alias details.
   */
  readonly alias?: Alias;
}
