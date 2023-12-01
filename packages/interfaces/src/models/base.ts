import { UnsoldMintingOptions } from './collection';
import { NftAccess } from './nft';
import { Network } from './transaction';

/**
 * Timestamp object.
 */
export class Timestamp {
  constructor(
    public readonly seconds: number,
    public readonly nanoseconds: number,
  ) {}

  public static now = () => this.fromMillis(Date.now());

  public static fromDate = (date: Date) => this.fromMillis(date.getTime());

  public static fromMillis = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const nanoseconds = Math.floor((milliseconds / 1000 - seconds) * 1e9);
    return new Timestamp(seconds, nanoseconds);
  };

  public toDate = () => {
    const milliseconds = this.toMillis();
    return new Date(milliseconds);
  };

  public toMillis = () => {
    const seconds = this.seconds + this.nanoseconds / 1e9;
    return Math.floor(seconds * 1000);
  };
}

export interface Build5Request<T> {
  address: NetworkAddress;
  signature?: string;
  projectApiKey: string;
  customToken?: string;
  publicKey?: {
    hex: string;
    network: Network;
  };
  legacyPublicKey?: {
    hex: string;
    network: Network;
  };
  body: T;
}

export enum COL {
  MEMBER = 'member',
  AWARD = 'award',
  COLLECTION = 'collection',
  NFT = 'nft',
  SPACE = 'space',
  PROPOSAL = 'proposal',
  NOTIFICATION = 'notification',
  MILESTONE = 'milestone',
  MILESTONE_RMS = 'milestone_rms_t2',
  MILESTONE_SMR = 'milestone_smr',
  TRANSACTION = 'transaction',
  BADGES = 'badges',
  AVATARS = 'avatars',
  TOKEN = 'token',
  TOKEN_MARKET = 'token_market',
  TOKEN_PURCHASE = 'token_purchase',
  TICKER = 'ticker',
  STAKE = 'stake',
  STAKE_REWARD = 'stake_reward',
  NFT_STAKE = 'nft_stake',
  AIRDROP = 'airdrop',
  PROJECT = 'project',
  STAMP = 'stamp',
  AUCTION = 'auction',

  MNEMONIC = '_mnemonic',
  SYSTEM = '_system',
  DB_ROLL_FILES = '_db_roll_files',
}

export const enum SUB_COL {
  OWNERS = 'owners',
  PARTICIPANTS = 'participants',
  MEMBERS = 'members',
  GUARDIANS = 'guardians',
  ADMINS = 'ADMINS',
  BLOCKED_MEMBERS = 'blockedMembers',
  KNOCKING_MEMBERS = 'knockingMembers',
  TRANSACTIONS = 'transactions',
  DISTRIBUTION = 'distribution',
  STATS = 'stats',
  VOTES = 'votes',
  RANKS = 'ranks',
  _API_KEY = '_api_key',
}

export const enum AWARD_COL {
  OWNERS = 'owners',
}

/**
 * Accepted networks: Ethereum, Shimmer and IOTA.
 */
export type NetworkAddress = string;

export type IpfsCid = string;

export interface Base {
  uid: string;
}

export interface BaseSubCollection {
  project?: string;
  parentId: string;
  parentCol: string;
}

/**
 * Base record structure.
 *
 * Every object will have these basic fields.
 */
export interface BaseRecord extends Base {
  project?: string;
  /**
   * Date/time it was created on.
   */
  createdOn?: Timestamp;
  /**
   * Date/time it was updated on.
   */
  updatedOn?: Timestamp;
  /**
   * Member UID {@link Member}
   */
  createdBy?: string;

  // Sharabble url
  wenUrl?: string;

  // Doc cursor used internally.
  _doc?: any;
  // Sometimes we want data from parent collecton because we search through it.
  _subColObj?: any;
}

export interface FileMetedata {
  metadata: IpfsCid;
  original: IpfsCid;
  avatar: IpfsCid;
  fileName: string;
  available?: boolean;
}

export enum FILE_SIZES {
  small = '200X200',
  medium = '680X680',
  large = '1600X1600',
}

/**
 * Access to collections.
 *
 * @category Accesss Cat
 */
export enum Access {
  OPEN = 0,
  MEMBERS_ONLY = 1,
  GUARDIANS_ONLY = 2,
  MEMBERS_WITH_BADGE = 3,
  MEMBERS_WITH_NFT_FROM_COLLECTION = 4,
}

/**
 * Validated address sub object.
 */
export interface ValidatedAddress {
  [Network.IOTA]: string;
  [Network.ATOI]: string;
  [Network.SMR]: string;
  [Network.RMS]: string;
}

/**
 * NFT Minted Metadata.
 */
export interface NftMintingData {
  readonly address?: string;
  readonly network?: Network;

  readonly mintedOn?: Timestamp;
  readonly mintedBy?: string;

  readonly blockId?: string;
  readonly nftId?: string;
  readonly storageDeposit?: number;

  readonly aliasBlockId?: string;
  readonly aliasId?: string;
  readonly aliasStorageDeposit?: number;

  readonly mintingOrderId?: string;

  readonly nftsToMint?: number;
  readonly nftMediaToUpload?: number;
  readonly nftMediaToPrepare?: number;
  readonly unsoldMintingOptions?: UnsoldMintingOptions;
  readonly newPrice?: number;
  readonly nftsStorageDeposit?: number;
}

export interface Vote extends BaseSubCollection {
  readonly direction: -1 | 1;
}

export interface VoteStats {
  readonly upvotes: number;
  readonly downvotes: number;
  readonly voteDiff: number;
}

export interface Rank extends BaseSubCollection {
  readonly rank: number;
}

export interface RankStats {
  readonly count: number;
  readonly sum: number;
  readonly avg: number;
}

/**
 * Status of media upload to the IPFS.
 */
export enum MediaStatus {
  UPLOADED = 'uploaded',
  PENDING_UPLOAD = 'pending_upload',
  ERROR = 'error',
  PREPARE_IPFS = 'prepare_ipfs',
}

/**
 * Restrictions set on the Collection/NFT during the it's purchase.
 */
export interface Restrictions {
  readonly collection?: {
    readonly access?: Access;
    readonly accessAwards?: string[];
    readonly accessCollections?: string[];
  };
  readonly nft?: {
    readonly saleAccess?: NftAccess;
    readonly saleAccessMembers?: string[];
  };
}
