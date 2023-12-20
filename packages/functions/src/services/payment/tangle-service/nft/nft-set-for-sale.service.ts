import { build5Db } from '@build-5/database';
import {
  Auction,
  AuctionType,
  COL,
  Collection,
  CollectionStatus,
  DEFAULT_NETWORK,
  EXTEND_AUCTION_WITHIN,
  Member,
  Nft,
  NftAccess,
  NftSetForSaleRequest,
  TangleResponse,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { assertMemberHasValidAddress } from '../../../../utils/address.utils';
import { getDefaultNetwork } from '../../../../utils/config.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { BaseTangleService, HandlerParams } from '../../base';
import { setNftForSaleTangleSchema } from './NftSetForSaleTangleRequestSchema';

export class TangleNftSetForSaleService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({ owner, request, project }: HandlerParams) => {
    const params = await assertValidationAsync(setNftForSaleTangleSchema, request);
    const memberDocRef = build5Db().doc(`${COL.MEMBER}/${owner}`);
    const member = await memberDocRef.get<Member>();

    const { nft, auction } = await getNftSetForSaleParams(member!, project, params);
    const nftDocRef = build5Db().doc(`${COL.NFT}/${params.nft}`);
    this.transactionService.push({ ref: nftDocRef, data: nft, action: 'update' });

    if (auction) {
      const auctionDocRef = build5Db().doc(`${COL.AUCTION}/${auction.uid}`);
      this.transactionService.push({ ref: auctionDocRef, data: auction, action: 'set' });
    }

    return { status: 'success' };
  };
}

export const getNftSetForSaleParams = async (
  owner: Member,
  project: string,
  params: NftSetForSaleRequest,
) => {
  const nftDocRef = build5Db().doc(`${COL.NFT}/${params.nft}`);
  const nft = await nftDocRef.get<Nft>();
  if (!nft) {
    throw invalidArgument(WenError.nft_does_not_exists);
  }

  if (nft.auctionFrom && dayjs(nft.auctionFrom.toDate()).isBefore(dayjs())) {
    throw invalidArgument(WenError.auction_already_in_progress);
  }

  if (nft.setAsAvatar) {
    throw invalidArgument(WenError.nft_set_as_avatar);
  }

  if (nft.hidden) {
    throw invalidArgument(WenError.hidden_nft);
  }

  if (nft.placeholderNft) {
    throw invalidArgument(WenError.nft_placeholder_cant_be_updated);
  }

  if (nft.owner !== owner.uid) {
    throw invalidArgument(WenError.you_must_be_the_owner_of_nft);
  }

  assertMemberHasValidAddress(owner, nft.mintingData?.network || DEFAULT_NETWORK);

  if (params.availableFrom) {
    params.availableFrom = dateToTimestamp(params.availableFrom, true).toDate();
  }

  if (params.auctionFrom) {
    params.auctionFrom = dateToTimestamp(params.auctionFrom, true).toDate();
  }

  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${nft.collection}`);
  const collection = await collectionDocRef.get<Collection>();
  if (![CollectionStatus.PRE_MINTED, CollectionStatus.MINTED].includes(collection?.status!)) {
    throw invalidArgument(WenError.invalid_collection_status);
  }

  const auction = getAuctionData(project, owner.uid, params, nft);
  return { nft: { ...getNftUpdateData(params), auction: auction?.uid || '' }, auction };
};

const getNftUpdateData = (params: NftSetForSaleRequest) => {
  const update: Record<string, unknown> = {
    saleAccess: params.access || NftAccess.OPEN,
    saleAccessMembers: params.accessMembers || [],
  };

  if (params.auctionFrom) {
    update.auctionFrom = params.auctionFrom;
    update.auctionTo = dayjs(params.auctionFrom)
      .add(params.auctionLength || 0)
      .toDate();
    update.auctionFloorPrice = params.auctionFloorPrice;
    update.auctionLength = params.auctionLength;
    update.auctionHighestBid = 0;
    update.auctionHighestBidder = null;
    if (params.extendedAuctionLength) {
      update.extendedAuctionTo = dayjs(params.auctionFrom)
        .add(params.extendedAuctionLength)
        .toDate();
      update.extendedAuctionLength = params.extendedAuctionLength;
      update.extendAuctionWithin = params.extendAuctionWithin || EXTEND_AUCTION_WITHIN;
    }
  } else {
    update.auctionFrom = null;
    update.auctionTo = null;
    update.extendedAuctionTo = null;
    update.auctionFloorPrice = null;
    update.auctionLength = null;
    update.extendedAuctionLength = null;
    update.auctionHighestBid = null;
    update.auctionHighestBidder = null;
  }

  if (params.availableFrom) {
    update.availableFrom = params.availableFrom;
    update.availablePrice = params.price;
  } else {
    update.availableFrom = null;
    update.availablePrice = null;
  }
  return update;
};

const getAuctionData = (project: string, owner: string, params: NftSetForSaleRequest, nft: Nft) => {
  if (!params.auctionFrom) {
    return;
  }
  const auction: Auction = {
    uid: getRandomEthAddress(),
    space: nft.space,
    createdBy: owner,
    project,
    auctionFrom: dateToTimestamp(params.auctionFrom),
    auctionTo: dateToTimestamp(dayjs(params.auctionFrom).add(params.auctionLength || 0)),
    auctionLength: params.auctionLength!,

    auctionFloorPrice: params.auctionFloorPrice || 0,
    minimalBidIncrement: params.minimalBidIncrement || 0,

    bids: [],
    maxBids: 1,
    type: AuctionType.NFT,
    network: nft.mintingData?.network || getDefaultNetwork(),
    nftId: nft.uid,

    active: true,
  };

  if (params.extendedAuctionLength) {
    return {
      ...auction,
      extendedAuctionTo: dayjs(params.auctionFrom).add(params.extendedAuctionLength).toDate(),
      extendedAuctionLength: params.extendedAuctionLength || 0,
      extendAuctionWithin: params.extendAuctionWithin || EXTEND_AUCTION_WITHIN,
    };
  }

  return auction;
};
