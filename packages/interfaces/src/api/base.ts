export enum PublicCollections {
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
}

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
}

export const QUERY_MIN_LENGTH = 1;
export const QUERY_MAX_LENGTH = 100;

export enum ApiRoutes {
  GET_BY_ID = '/getById',
  GET_MANY = '/getMany',
  GET_UPDATED_AFTER = '/getUpdatedAfter',
  GET_TOKEN_PRICE = '/getTokenPrice',
  GET_ADDRESSES = '/addresses',
}
