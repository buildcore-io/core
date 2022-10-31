import { Network } from './models';

export class RelatedRecordsResponse {
  public static status = false;
}
// 5m in advance.
export class ProposalStartDateMin {
  public static value = 5 * 60 * 1000;
}

// 1d in advance.
export class NftAvailableFromDateMin {
  public static value = 24 * 60 * 60 * 1000;
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
export const WEN_PROD_ADDRESS = 'https://soonaverse.com/';
export const WEN_TEST_ADDRESS = 'https://wen2.soonaverse.com/';
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
export const IPFS_GATEWAY = 'https://ipfs.soonaverse.com/ipfs/';
export const BADGE_TO_CREATE_COLLECTION: string[] = [
  '0x6baa35ee540ce700978226aaab2b1d97d8fb54ba',
  '0x3ccb9fe9d6f429981522fb1927a2259149a4a192',
  '0x2e6c7d3efee5d931b05a7908295c10732417ed89',
  '0x8e3e0e81249a450181a7226d85fadc8102fd4ac2',
  '0x4d90ade7678da9b1f1496668a05bb736022e2f98',
  '0x78e16b91cff436982d01a2adc36609a255befb01',
  '0x178cb0e3815f5e579da214bca4262a2bb261c7ff',
];

// FEES.
export const SOONAVERSE_FEE = 10;

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