import { BaseRecord, EthAddress, MediaStatus, NftMintingData, Timestamp } from './base';
import { CollectionType } from './collection';

/**
 * Max NFT properties.
 */
export const MAX_PROPERTIES_COUNT = 25;
/**
 * Max NFT stats.
 */
export const MAX_STATS_COUNT = 25;
export const PRICE_UNITS: ('Mi' | 'Gi')[] = ['Mi', 'Gi'];

/**
 * NFT Prop/stats.
 */
export interface PropStats {
  [propName: string]: {
    label: string;
    value: string;
  };
}

/**
 * NFT Access options.
 */
export enum NftAccess {
  OPEN = 0,
  MEMBERS = 1,
}

/**
 * NFT Available options.
 */
export enum NftAvailable {
  UNAVAILABLE = 0,
  SALE = 1,
  AUCTION = 2,
  AUCTION_AND_SALE = 3,
}

/**
 * NFT status.
 */
export enum NftStatus {
  PRE_MINTED = 'pre_minted',
  MINTED = 'minted',
  WITHDRAWN = 'withdrawn',
  STAKED = 'staked',
}

/**
 * NFT record.
 */
export interface Nft extends BaseRecord {
  name: string;
  description: string;
  collection: EthAddress;
  owner?: EthAddress;
  isOwned?: boolean;
  media: string;
  ipfsMedia: string;
  ipfsMetadata: string;
  ipfsRoot?: string;
  saleAccess?: NftAccess;
  saleAccessMembers?: string[];
  available: NftAvailable;
  availableFrom: Timestamp | null;
  auctionFrom?: Timestamp | null;
  auctionTo?: Timestamp | null;
  auctionHighestBid?: number | null;
  auctionHighestBidder?: string | null;
  auctionHighestTransaction?: string | null;
  price: number;
  totalTrades: number;
  lastTradedOn: Timestamp | null;
  availablePrice?: number | null;
  auctionFloorPrice?: number | null;
  auctionLength?: number | null;
  type: CollectionType;
  space: string;
  url: string;
  approved: boolean;
  rejected: boolean;
  properties: PropStats;
  stats: PropStats;
  placeholderNft: boolean;
  position: number;
  locked?: boolean;
  lockedBy?: string | null;
  sold?: boolean;
  mintingData?: NftMintingData;
  depositData?: NftMintingData;
  status?: NftStatus;
  hidden?: boolean;
  mediaStatus?: MediaStatus;
  soldOn?: Timestamp;
  setAsAvatar?: boolean;
}
