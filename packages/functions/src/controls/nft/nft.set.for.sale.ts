import {
  COL,
  Collection,
  CollectionStatus,
  DEFAULT_NETWORK,
  Member,
  Nft,
  NftAccess,
  Timestamp,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../database/wrapper/soondb';
import { assertMemberHasValidAddress } from '../../utils/address.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';

export const setForSaleNftControl = async (owner: string, params: Record<string, unknown>) => {
  const memberDocRef = soonDb().doc(`${COL.MEMBER}/${owner}`);
  const member = await memberDocRef.get<Member>();
  if (!member) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const nftDocRef = soonDb().doc(`${COL.NFT}/${params.nft}`);
  const nft = await nftDocRef.get<Nft>();
  if (!nft) {
    throw throwInvalidArgument(WenError.nft_does_not_exists);
  }

  if (nft.setAsAvatar) {
    throw throwInvalidArgument(WenError.nft_set_as_avatar);
  }

  if (nft.hidden) {
    throw throwInvalidArgument(WenError.hidden_nft);
  }

  if (nft.placeholderNft) {
    throw throwInvalidArgument(WenError.nft_placeholder_cant_be_updated);
  }

  if (nft.owner !== owner) {
    throw throwInvalidArgument(WenError.you_must_be_the_owner_of_nft);
  }

  assertMemberHasValidAddress(member, nft.mintingData?.network || DEFAULT_NETWORK);

  if (params.availableFrom) {
    params.availableFrom = dateToTimestamp(params.availableFrom as Date, true);
  }

  if (params.auctionFrom) {
    params.auctionFrom = dateToTimestamp(params.auctionFrom as Date, true);
  }

  if (params.auctionFrom && nft.auctionFrom && dayjs(nft.auctionFrom.toDate()).isBefore(dayjs())) {
    throw throwInvalidArgument(WenError.nft_auction_already_in_progress);
  }

  const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${nft.collection}`);
  const collection = await collectionDocRef.get<Collection>();
  if (![CollectionStatus.PRE_MINTED, CollectionStatus.MINTED].includes(collection?.status!)) {
    throw throwInvalidArgument(WenError.invalid_collection_status);
  }

  await nftDocRef.update(getNftUpdateData(params));
  return await nftDocRef.get<Nft>();
};

const getNftUpdateData = (params: Record<string, unknown>) => {
  const update: Record<string, unknown> = {
    saleAccess: params.access || NftAccess.OPEN,
    saleAccessMembers: params.accessMembers || [],
  };

  if (params.auctionFrom) {
    update.auctionFrom = params.auctionFrom;
    update.auctionTo = dayjs((params.auctionFrom as Timestamp).toDate())
      .add(parseInt(params.auctionLength as string), 'ms')
      .toDate();
    update.auctionFloorPrice = parseInt(params.auctionFloorPrice as string);
    update.auctionLength = parseInt(params.auctionLength as string);
    update.auctionHighestBid = 0;
    update.auctionHighestBidder = null;
    update.auctionHighestTransaction = null;
  } else {
    update.auctionFrom = null;
    update.auctionTo = null;
    update.auctionFloorPrice = null;
    update.auctionLength = null;
    update.auctionHighestBid = null;
    update.auctionHighestBidder = null;
    update.auctionHighestTransaction = null;
  }

  if (params.availableFrom) {
    update.availableFrom = params.availableFrom;
    update.availablePrice = parseInt(params.price as string);
  } else {
    update.availableFrom = null;
    update.availablePrice = null;
  }
  return update;
};
