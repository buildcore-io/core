import { Network } from "./models";

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
  TOKEN_MARKET = 'token_market'
}

export const WEN_NAME = 'Soonaverse';
export const WEN_PROD_ADDRESS = 'https://soonaverse.com/';
export const WEN_TEST_ADDRESS = 'https://wen.soonaverse.com/';
export const GITHUB_REGEXP = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
export const DISCORD_REGEXP = /^.{3,32}#[0-9]{4}$/i;
export const TWITTER_REGEXP = /^@?(\w){1,15}$/i;
/* eslint-disable */
export const URL_REGEXP = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/i;
export const FILENAME_REGEXP = /^[a-zA-Z0-9_-]+$/i;
/* eslint-enable */
export const NFT_CONTRACT_ADDRESS = '';
export const METAMASK_CHAIN_ID = '0x432';
export const GLOBAL_DEBOUNCE_TIME = 500;
export const KEY_NAME_TANGLE = 'Soonaverse';
export const DEF_WALLET_PAY_IN_PROGRESS = 'payment-in-progress-';
export const TIME_GAP_BETWEEN_MILESTONES = 10;
export const EXTENDED_TRANSACTION_RETRY = 10 * 60 * 1000;
export const DEFAULT_TRANSACTION_RETRY = 90 * 1000;
export const SECONDARY_TRANSACTION_DELAY = 60 * 1000;
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
  '0x4d90ade7678da9b1f1496668a05bb736022e2f98'
];
export const RPC_CHAIN = {
  chainId: METAMASK_CHAIN_ID,
  chainName: 'IOTA EVM',
  nativeCurrency: {
    name: 'IOTA',
    symbol: 'IOTA',
    decimals: 18
  },
  rpcUrls: ['https://evm.wasp.sc.iota.org/'],
  // blockExplorerUrls?: string[];
  // iconUrls?: string[]; // Currently ignored.
}
export const MIN_TOTAL_TOKEN_SUPPLY = 100;
export const MAX_TOTAL_TOKEN_SUPPLY = 100000000000000000;
export const MIN_TOKEN_START_DATE_DAY = 7
export const DEFAULT_NETWORK = Network.IOTA
