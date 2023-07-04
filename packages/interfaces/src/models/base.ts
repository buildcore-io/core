import { UnsoldMintingOptions } from './collection';
import { NftAccess } from './nft';
import { Network } from './transaction';

export class Timestamp {
  constructor(public readonly seconds: number, public readonly nanoseconds: number) {}

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

export interface WenRequest {
  address: string;
  signature?: string;
  customToken?: string;
  publicKey?: {
    hex: string;
    network: Network;
  };
  body: any;
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
  MILESTONE_ATOI = 'milestone_atoi',
  MILESTONE_RMS = 'milestone_rms',
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

  MNEMONIC = '_mnemonic',
  SYSTEM = '_system',
  DB_ROLL_FILES = '_db_roll_files',
  KEEP_ALIVE = 'keep_alive',
}

export const enum SUB_COL {
  OWNERS = 'owners',
  PARTICIPANTS = 'participants',
  MEMBERS = 'members',
  GUARDIANS = 'guardians',
  BLOCKED_MEMBERS = 'blockedMembers',
  KNOCKING_MEMBERS = 'knockingMembers',
  TRANSACTIONS = 'transactions',
  DISTRIBUTION = 'distribution',
  STATS = 'stats',
  VOTES = 'votes',
  RANKS = 'ranks',
}

export const enum AWARD_COL {
  OWNERS = 'owners',
}

export type EthAddress = string;
export type IotaAddress = string;
export type IpfsCid = string;

export interface Base {
  uid: string;
}

export interface BaseSubCollection {
  parentId: string;
  parentCol: string;
}

export interface BaseRecord extends Base {
  createdOn?: Timestamp;
  updatedOn?: Timestamp;
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

export enum Access {
  OPEN = 0,
  MEMBERS_ONLY = 1,
  GUARDIANS_ONLY = 2,
  MEMBERS_WITH_BADGE = 3,
  MEMBERS_WITH_NFT_FROM_COLLECTION = 4,
}

export interface ValidatedAddress {
  [Network.IOTA]: string;
  [Network.ATOI]: string;
  [Network.SMR]: string;
  [Network.RMS]: string;
}

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

export interface Vote extends BaseSubCollection, BaseRecord {
  readonly direction: -1 | 1;
}

export interface VoteStats {
  readonly upvotes: number;
  readonly downvotes: number;
  readonly voteDiff: number;
}

export interface Rank extends BaseSubCollection, BaseRecord {
  readonly rank: number;
}

export interface RankStats {
  readonly count: number;
  readonly sum: number;
  readonly avg: number;
}

export enum MediaStatus {
  UPLOADED = 'uploaded',
  PENDING_UPLOAD = 'pending_upload',
  ERROR = 'error',
  PREPARE_IPFS = 'prepare_ipfs',
}

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
