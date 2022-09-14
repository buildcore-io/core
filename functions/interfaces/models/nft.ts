import { BaseRecord, EthAddress, Timestamp } from '../../interfaces/models/base';
import { CollectionType } from './collection';
import { Network } from './transaction';

export const MAX_PROPERTIES_COUNT = 25;
export const MAX_STATS_COUNT = 25;
export const PRICE_UNITS: ('Mi' | 'Gi')[] = ['Mi', 'Gi'];

export interface PropStats {
  [propName: string]: {
    label: string,
    value: string
  }
}

export enum NftAccess {
  OPEN = 0,
  MEMBERS = 1
}

export enum NftAvailable {
  UNAVAILABLE = 0,
  SALE = 1,
  AUCTION = 2,
  AUCTION_AND_SALE = 3
}

export interface NftMintingData {
  readonly storageDeposit?: number;
  readonly address?: string;
  readonly network?: Network;
  readonly mintedOn?: Timestamp;
  readonly mintedBy?: string;
}

export enum NftStatus {
  PRE_MINTED = 'pre_minted',
  MINTED = 'minted',
  WITHDRAWN = 'withdrawn'
}

export interface Nft extends BaseRecord {
  name: string;
  description: string;
  collection: EthAddress;
  owner?: EthAddress;
  isOwned?: boolean;
  media: string;
  ipfsMedia: string;
  ipfsMetadata: string;
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
  locked?: boolean;
  lockedBy?: string;
  sold?: boolean;
  mintingData?: NftMintingData;
  status?: NftStatus;
  hidden?: boolean;
}
