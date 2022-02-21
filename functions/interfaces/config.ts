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

export const WEN_NAME = 'Soonaverse';
export const GITHUB_REGEXP = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
export const DISCORD_REGEXP = /^.{3,32}#[0-9]{4}$/i;
export const TWITTER_REGEXP = /^@?(\w){1,15}$/i;
export const URL_REGEXP = /[(http(s)?)://(www.)?a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/i;
export const NFT_CONTRACT_ADDRESS = '';
export const METAMASK_CHAIN_ID = '0x432';
export const GLOBAL_DEBOUNCE_TIME = 500;
export const KEY_NAME_TANGLE = 'Soonaverse';
export const TIME_GAP_BETWEEN_MILESTONES = 10;
export const DEFAULT_TRANSACTION_DELAY = 60 * 1000;
export const MAX_WALLET_RETRY = 5;
export const MIN_AMOUNT_TO_TRANSFER = 1 * 1000 * 1000;
export const MIN_IOTA_AMOUNT = 10 * 1000 * 1000;
export const MAX_IOTA_AMOUNT = 1000 * 1000 * 1000 * 1000;
export const IPFS_GATEWAY = 'https://ipfs.soonaverse.com/ipfs/';
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
