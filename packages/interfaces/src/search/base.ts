import { COL, SUB_COL } from '../models';

export enum Dataset {
  AIRDROP = COL.AIRDROP,
  AVATARS = COL.AVATARS,
  AWARD = COL.AWARD,
  AUCTION = COL.AUCTION,
  BADGES = COL.BADGES,
  COLLECTION = COL.COLLECTION,
  MILESTONE = COL.MILESTONE,
  MILESTONE_RMS = COL.MILESTONE_RMS,
  MILESTONE_SMR = COL.MILESTONE_SMR,
  MEMBER = COL.MEMBER,
  NFT = COL.NFT,
  NFT_STAKE = COL.NFT_STAKE,
  NOTIFICATION = COL.NOTIFICATION,
  PROJECT = COL.PROJECT,
  PROPOSAL = COL.PROPOSAL,
  SPACE = COL.SPACE,
  STAKE = COL.STAKE,
  STAKE_REWARD = COL.STAKE_REWARD,
  STAMP = COL.STAMP,
  TOKEN = COL.TOKEN,
  TOKEN_MARKET = COL.TOKEN_MARKET,
  TOKEN_PURCHASE = COL.TOKEN_PURCHASE,
  TICKER = COL.TICKER,
  TRANSACTION = COL.TRANSACTION,
  SWAP = COL.SWAP,
  SOON_SNAP = COL.SOON_SNAP,
}

export enum Subset {
  OWNERS = SUB_COL.OWNERS,
  PARTICIPANTS = SUB_COL.PARTICIPANTS,
  MEMBERS = SUB_COL.MEMBERS,
  GUARDIANS = SUB_COL.GUARDIANS,
  BLOCKED_MEMBERS = SUB_COL.BLOCKED_MEMBERS,
  KNOCKING_MEMBERS = SUB_COL.KNOCKING_MEMBERS,
  TRANSACTIONS = SUB_COL.TRANSACTIONS,
  DISTRIBUTION = SUB_COL.DISTRIBUTION,
  STATS = SUB_COL.STATS,
  VOTES = SUB_COL.VOTES,
  RANKS = SUB_COL.RANKS,
}

/**
 * QUERY min length
 */
export const QUERY_MIN_LENGTH = 1;
/**
 * QUERY max length
 */
export const QUERY_MAX_LENGTH = 100;

/**
 * Public API routes.
 */
export enum ApiRoutes {
  GET_BY_ID = '/search/getById',
  GET_MANY_BY_ID = '/search/getManyById',
  GET_MANY = '/search/getMany',
  GET_MANY_ADVANCED = '/search/getManyAdvanced',
  GET_UPDATED_AFTER = '/search/getUpdatedAfter',
  GET_TOKEN_PRICE = '/search/getTokenPrice',
  GET_AVG_PRICE = '/search/getAvgPrice',
  GET_PRICE_CHANGE = '/search/getPriceChange',
  GET_ADDRESSES = '/search/addresses',
  GET_TOP_MILESTONES = '/search/getTopMilestones',

  GET_NFT_MUTABLE_METADATA = '/search/getNftMutableMetadata',
  GET_NFT_IDS = '/search/getNftIds',
  GET_NFT_MUTABLE_METADATA_HISTORY = '/search/getNftMutableMetadataHistory',
}

export const PING_INTERVAL = 10000;
