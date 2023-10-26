/**
 * Public collections to access via API.
 */
export enum PublicCollections {
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
}

/**
 * Public sub-collections to access via API.
 */
export enum PublicSubCollections {
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
  GET_BY_ID = '/getById',
  GET_MANY_BY_ID = '/getManyById',
  GET_MANY = '/getMany',
  GET_MANY_ADVANCED = '/getManyAdvanced',
  GET_UPDATED_AFTER = '/getUpdatedAfter',
  GET_TOKEN_PRICE = '/getTokenPrice',
  GET_AVG_PRICE = '/getAvgPrice',
  GET_PRICE_CHANGE = '/getPriceChange',
  GET_ADDRESSES = '/addresses',
  GET_TOP_MILESTONES = '/getTopMilestones',
  KEEP_ALIVE = '/keepAlive',

  GET_NFT_MUTABLE_METADATA = '/getNftMutableMetadata',
  GET_NFT_IDS = '/getNftIds',
  GET_NFT_MUTABLE_METADATA_HISTORY = '/getNftMutableMetadataHistory',
}

export const PING_INTERVAL = 10000;
