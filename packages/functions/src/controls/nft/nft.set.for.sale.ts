import {
  COL,
  Collection,
  CollectionStatus,
  DEFAULT_NETWORK,
  Member,
  Nft,
  NftAccess,
  NftSetForSaleRequest,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../../firebase/firestore/build5Db';
import { assertMemberHasValidAddress } from '../../utils/address.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';

export const setForSaleNftControl = async (
  owner: string,
  params: NftSetForSaleRequest,
): Promise<Nft> => {
  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${owner}`);
  const member = await memberDocRef.get<Member>();
  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  const nftDocRef = build5Db().doc(`${COL.NFT}/${params.nft}`);
  const nft = await nftDocRef.get<Nft>();
  if (!nft) {
    throw invalidArgument(WenError.nft_does_not_exists);
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

  if (nft.owner !== owner) {
    throw invalidArgument(WenError.you_must_be_the_owner_of_nft);
  }

  assertMemberHasValidAddress(member, nft.mintingData?.network || DEFAULT_NETWORK);

  if (params.availableFrom) {
    params.availableFrom = dateToTimestamp(params.availableFrom, true).toDate();
  }

  if (params.auctionFrom) {
    params.auctionFrom = dateToTimestamp(params.auctionFrom, true).toDate();
  }

  if (params.auctionFrom && nft.auctionFrom && dayjs(nft.auctionFrom.toDate()).isBefore(dayjs())) {
    throw invalidArgument(WenError.nft_auction_already_in_progress);
  }

  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${nft.collection}`);
  const collection = await collectionDocRef.get<Collection>();
  if (![CollectionStatus.PRE_MINTED, CollectionStatus.MINTED].includes(collection?.status!)) {
    throw invalidArgument(WenError.invalid_collection_status);
  }

  await nftDocRef.update(getNftUpdateData(params));
  return (await nftDocRef.get<Nft>())!;
};

const getNftUpdateData = (params: NftSetForSaleRequest) => {
  const update: Record<string, unknown> = {
    saleAccess: params.access || NftAccess.OPEN,
    saleAccessMembers: params.accessMembers || [],
  };

  if (params.auctionFrom) {
    update.auctionFrom = params.auctionFrom;
    update.auctionTo = dayjs(params.auctionFrom)
      .add(params.auctionLength || 0, 'ms')
      .toDate();
    update.auctionFloorPrice = params.auctionFloorPrice;
    update.auctionLength = params.auctionLength;
    update.auctionHighestBid = 0;
    update.auctionHighestBidder = null;
    update.auctionHighestTransaction = null;
    if (params.extendedAuctionLength) {
      update.extendedAuctionTo = dayjs(params.auctionFrom)
        .add(params.extendedAuctionLength, 'ms')
        .toDate();
      update.extendedAuctionLength = params.extendedAuctionLength;
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
    update.auctionHighestTransaction = null;
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
