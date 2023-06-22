import { COL, Network } from './models';

export class RelatedRecordsResponse {
  public static status = false;
}
// 5m in advance.
export class ProposalStartDateMin {
  public static value = 5 * 60 * 1000;
}

export class AppCheck {
  public static enabled = true;
}

export enum URL_PATHS {
  NFT = 'nft',
  SPACE = 'space',
  PROPOSAL = 'proposal',
  AWARD = 'award',
  MEMBER = 'member',
  COLLECTION = 'collection',
  TOKEN = 'token',
  TOKEN_MARKET = 'token_market',
  TRANSACTION = 'transaction',
}

export const WEN_NAME = 'Soonaverse';
export const SOON_SPACE = '0x5fcc5562385e6c2f6b0a5934280e5d11274f8e07';
export const SOON_TOKEN = '0x9600b5afbb84f15e0d4c0f90ea60b2b8d7bd0f1e';
export const SOON_SPACE_TEST = '0x0702535a8409d58d832fe80660c28dc61dee9704';
export const SOON_TOKEN_TEST = '0x15e7e6663f3a88c0cce72a4cc3cd5c6786f0b1cf';
export const SOON_PROD_ADDRESS = 'https://soonaverse.com/';
export const SOON_TEST_ADDRESS = 'https://wen2.soonaverse.com/';
export const SOON_PROD_ADDRESS_API = 'https://api.soonaverse.com/';
export const SOON_TEST_ADDRESS_API = 'https://api-wen.build5.com/';
export const GITHUB_REGEXP = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
export const DISCORD_REGEXP = /^.{3,32}#[0-9]{4}$/i;
export const TWITTER_REGEXP = /^@?(\w){1,15}$/i;
/* eslint-disable */
export const URL_REGEXP =
  /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/i;
export const FILENAME_REGEXP = /^[a-zA-Z0-9_-]+$/i;
/* eslint-enable */
export const NFT_CONTRACT_ADDRESS = '';
export const GLOBAL_DEBOUNCE_TIME = 500;
export const KEY_NAME_TANGLE = WEN_NAME;
export const DEF_WALLET_PAY_IN_PROGRESS = 'payment-in-progress-';
export const TIME_GAP_BETWEEN_MILESTONES = 10;
export const EXTENDED_TRANSACTION_RETRY = 10 * 60 * 1000;
export const DEFAULT_TRANSACTION_RETRY = 90 * 1000;
export const RETRY_UNCOFIRMED_PAYMENT_DELAY = 3 * 60 * 1000;
export const MAX_WALLET_RETRY = 5;
export const MIN_AMOUNT_TO_TRANSFER = 1 * 1000 * 1000;
export const MIN_IOTA_AMOUNT = MIN_AMOUNT_TO_TRANSFER;
export const MAX_IOTA_AMOUNT = 1000 * 1000 * 1000 * 1000;
export const IPFS_GATEWAY_AVATAR = 'https://ipfs2.soonaverse.com/ipfs/';
export const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';
export const TOKEN_EXPIRY_HOURS = 1;
// FEES.
export const SOONAVERSE_FEE = 10;
export const PROPOSAL_COMMENCING_IN_DAYS = 1;

// Service modules
export const SERVICE_MODULE_FEE_TOKEN_EXCHANGE = 2.5;

export const TOKEN_SALE = {
  percentage: SERVICE_MODULE_FEE_TOKEN_EXCHANGE,
  spaceonepercentage: SOONAVERSE_FEE,
  spaceone: '0xeeb14e6bc79c33f5077fe5c8ba4db60d1da91af6',
  spacetwo: '0x5051c939c5ef8a4f4e4cd3caf73f6c34579e125c',
};

export const TOKEN_SALE_TEST = {
  percentage: SERVICE_MODULE_FEE_TOKEN_EXCHANGE,
  spaceonepercentage: SOONAVERSE_FEE,
  spaceone: '0x41918fd41d18aa9415b3b3d426df25549670a60c',
  spacetwo: '0xbeac4a5e45080120f43539a638c8de42c2219e28',
};

// https://home.treasury.gov/policy-issues/financial-sanctions/sanctions-programs-and-country-information
export const DEFAULT_US_BLOCKED_COUNTRIES = [
  'AF',
  'BY',
  'MM',
  'CF',
  'CU',
  'CD',
  'ET',
  'ET',
  'IR',
  'IQ',
  'LB',
  'LY',
  'KP',
  'RU',
  'SO',
  'SD',
  'SS',
  'SY',
  'VE',
  'ZW',
  'YE',
];
export const BLOCKED_COUNTRIES = {
  common: DEFAULT_US_BLOCKED_COUNTRIES,
  // All tokens are blocked in US/CA
  token: ['US', 'CA'],
  // Exceptions.
  // SOON Token has legal advice.
  '0x9600b5afbb84f15e0d4c0f90ea60b2b8d7bd0f1e': DEFAULT_US_BLOCKED_COUNTRIES,
  // All IOTA trades
  '0xf0ae0ebc9c300657168a2fd20653799fbbfc3b48': DEFAULT_US_BLOCKED_COUNTRIES,
  // FEE token has no utility.
  '0x55cbe228505461bf3307a4f1ed951d0a059dd6d0': DEFAULT_US_BLOCKED_COUNTRIES,
  // XP Space has no utility.
  '0x05a1a9b2fe190d67ad2df020f112e3e91f32d90e': DEFAULT_US_BLOCKED_COUNTRIES,
};
export const MIN_TOTAL_TOKEN_SUPPLY = 100;
export const MAX_TOTAL_TOKEN_SUPPLY = 100000000000000000000000000;
export const MIN_TOKEN_START_DATE_DAY = 7;

export const DEFAULT_NETWORK = Network.IOTA;
export const PROD_NETWORKS = [Network.IOTA, Network.SMR];
export const TEST_NETWORKS = [Network.ATOI, Network.RMS];
export const PROD_AVAILABLE_MINTABLE_NETWORKS = [Network.SMR];
export const TEST_AVAILABLE_MINTABLE_NETWORKS = [Network.SMR, Network.RMS];
export const MAX_FIELD_NAME_LENGTH = 30;
export const MAX_FIELD_VALUE_LENGTH = 100;

export const MIN_WEEKS_TO_STAKE = 1;
export const MAX_WEEKS_TO_STAKE = 52;

export const tiers = [0, 10, 4000, 6000, 15000].map((v) => v * MIN_IOTA_AMOUNT);
export const tokenTradingFeeDicountPercentage = [0, 25, 50, 75, 100];

export const RANKING = {
  MIN_RANK: -100,
  MAX_RANK: 100,
  RANK_THRESHOLD: -100,
  tokenSpace: '0xa320b88362eb068d9e9f9723bbc74adccb5bddc4',
  collectionSpace: '0xa320b88362eb068d9e9f9723bbc74adccb5bddc4',
};

export const RANKING_TEST = {
  MIN_RANK: -100,
  MAX_RANK: 100,
  RANK_THRESHOLD: -100,
  tokenSpace: '0xf7cfe59ebece428fb9717a13d978f7f7c8e7c86f',
  collectionSpace: '0xf7cfe59ebece428fb9717a13d978f7f7c8e7c86f',
};

export const ADD_REMOVE_GUARDIAN_THRESHOLD_PERCENTAGE = 60;
export const UPDATE_SPACE_THRESHOLD_PERCENTAGE = 60;
export const REMOVE_STAKE_REWARDS_THRESHOLD_PERCENTAGE = 60;

export const STAKE_REWARD_CRON_INTERVAL_CONFIG = 'every 1 hours';
export const STAKE_REWARD_TEST_CRON_INTERVAL_CONFIG = 'every 5 minutes';

export enum Bucket {
  PROD_DEFAULT = 'soonaverse.appspot.com',
  PROD = 'images.soonaverse.com',
  TEST_DEFAULT = 'soonaverse-test.appspot.com',
  TEST = 'images-wen.soonaverse.com',
  DEV_DEFAULT = 'soonaverse-dev.appspot.com',
  DEV = 'soonaverse-dev-custom-bucket',
}

// key - WEN_FUNC
// value - token lifetime in seconds for the given WEN_FUNC
export const CUSTOM_TOKEN_MAX_LIFETIME: { [key: string]: number } = {};

export const MAX_AIRDROP = 10000;

export const ALGOLIA_COLLECTIONS = [
  COL.SPACE,
  COL.TOKEN,
  COL.AWARD,
  COL.NFT,
  COL.COLLECTION,
  COL.MEMBER,
  COL.PROPOSAL,
];

export const IMAGE_CACHE_AGE = 31536000; //  1 year in seconds

export const AVATAR_COLLECTION_PROD = '0x8b1d2626248961d63460368a642329071fbbf478';
export const AVATAR_COLLECTION_TEST = '0x439c87f97ece722312162a0b60bb27deb6908ab9';
