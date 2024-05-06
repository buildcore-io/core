import { BaseRecord, MediaStatus, NetworkAddress, NftMintingData, Timestamp } from './base';
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
  /**
   * NFT Name
   */
  name: string;
  /**
   * NFT Description
   */
  description: string;
  /**
   * NFT Collection {@link Collection}
   */
  collection: NetworkAddress;
  /**
   * NFT current owner {@link Member}
   */
  owner?: NetworkAddress;
  /**
   * NFT Is NFT owned. This field is used to simplify filtering.
   */
  isOwned?: boolean;
  /**
   * URL to the NFT image.
   */
  media: string;
  /**
   * IPFS CID for media link.
   */
  ipfsMedia: string;
  /**
   * IPFS CID for metadata link.
   */
  ipfsMetadata: string;
  /**
   * IPFS Root directory for all IPFS files.
   */
  ipfsRoot?: string;
  /**
   * See {@link NftAccess} for options
   */
  saleAccess?: NftAccess;
  /**
   * Sales access Members {@link saleAccess}
   */
  saleAccessMembers?: string[];
  /**
   * NFTs Availability.
   */
  available: NftAvailable;
  /**
   * NFT is available from (initial sale only)
   */
  availableFrom: Timestamp | null;
  /**
   * NFT Auction from date/time
   */
  auctionFrom?: Timestamp | null;
  /**
   * NFT Auction to date/time
   */
  auctionTo?: Timestamp | null;
  /**
   * NFT Auction extended to date/time
   */
  extendedAuctionTo?: Timestamp | null;
  /**
   * NFT Auction current highest bid
   */
  auctionHighestBid?: number | null;
  /**
   * NFT Auction current highest bidder {@link Member}
   */
  auctionHighestBidder?: string | null;
  /**
   * NFT current price based on previous sales
   */
  price: number;
  /**
   * Total number of trades for this NFT
   */
  totalTrades: number;
  /**
   * Last traded on.
   */
  lastTradedOn: Timestamp | null;
  /**
   * If on sale, available price for this NFT.
   */
  availablePrice?: number | null;
  /**
   * Auction minimum price.
   */
  auctionFloorPrice?: number | null;
  /**
   * Auction length.
   */
  auctionLength?: number | null;
  /**
   * Extended auction length.
   */
  extendedAuctionLength?: number | null;
  /**
   * Auction will be extended if a bid happens this many milliseconds before auction ends
   */
  extendAuctionWithin?: number | null;
  /**
   * Collection Type. Inherited from the {@link Collection}. It's hear for filtering purposes.
   */
  type: CollectionType;
  /**
   * Link to space {@link Space}
   */
  space: string;
  /**
   * URL to NFT
   */
  url: string;
  /**
   * NFT has been approved
   */
  approved: boolean;
  /**
   * NFT has been rejected
   */
  rejected: boolean;
  /**
   * NFTs properties
   */
  properties: PropStats;
  /**
   * NFTs stats
   */
  stats: PropStats;
  /**
   * Is this NFT placeholder
   */
  placeholderNft: boolean;
  /**
   * NFT position in the list. Helps randomness during the initial sale.
   *
   * @hidden
   */
  position: number;
  /**
   * NFT locked for sale.
   */
  locked?: boolean;
  /**
   * NFT is locked by member {@link Member}
   */
  lockedBy?: string | null;
  /**
   * Is NFT sold (always true after intial sale)
   */
  sold?: boolean;
  /**
   * NFT Minting data
   */
  mintingData?: NftMintingData;
  /**
   * NFT deposit data
   */
  depositData?: NftMintingData;
  /**
   * NFT status.
   */
  status?: NftStatus;
  /**
   * NFT is hidden
   *
   * @hidden
   */
  hidden?: boolean;
  /**
   * NFT Media status
   */
  mediaStatus?: MediaStatus;
  /**
   * @hidden
   */
  mediaUploadErrorCount?: number;
  /**
   * NFT Sold on
   */
  soldOn?: Timestamp;
  /**
   * NFT is set as avatar.
   */
  setAsAvatar?: boolean;
  /**
   * The buildcore id of the auction this nft belongs to
   */
  auction?: string | null;
}
