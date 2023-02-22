import {
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  DEFAULT_NETWORK,
  DiscountLine,
  NftStatus,
  Space,
  SpaceMember,
  SUB_COL,
  WenError,
} from '@soonaverse/interfaces';
import { Database } from '../../database/Database';
import { hasStakedSoonTokens } from '../../services/stake.service';
import { assertSpaceHasValidAddress } from '../../utils/address.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { populateTokenUidOnDiscounts } from './common';

export const createCollectionControl = async (owner: string, params: Record<string, unknown>) => {
  const hasStakedSoons = await hasStakedSoonTokens(owner);
  if (!hasStakedSoons) {
    throw throwInvalidArgument(WenError.no_staked_soon);
  }

  const space = await Database.getById<Space>(COL.SPACE, params.space as string);
  if (!space) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }
  assertSpaceHasValidAddress(space, DEFAULT_NETWORK);

  const spaceMember = await Database.getById<SpaceMember>(
    COL.SPACE,
    params.space as string,
    SUB_COL.MEMBERS,
    owner,
  );
  if (!spaceMember) {
    throw throwInvalidArgument(WenError.you_are_not_part_of_space);
  }

  const royaltySpace = await Database.getById<Space>(COL.SPACE, params.royaltiesSpace as string);
  if (!royaltySpace) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }
  assertSpaceHasValidAddress(royaltySpace, DEFAULT_NETWORK);

  if (params.availableFrom) {
    params.availableFrom = dateToTimestamp(params.availableFrom as Date, true);
  }

  const batchWriter = Database.createBatchWriter();

  const discounts = <DiscountLine[]>(params.discounts || []);
  const placeholderNftId = params.type !== CollectionType.CLASSIC ? getRandomEthAddress() : null;
  const collection = {
    ...params,
    discounts: await populateTokenUidOnDiscounts(discounts),
    uid: getRandomEthAddress(),
    total: 0,
    sold: 0,
    createdBy: owner,
    approved: false,
    rejected: false,
    ipfsMedia: null,
    limitedEdition: !!params.limitedEdition,
    placeholderNft: placeholderNftId || null,
    status: CollectionStatus.PRE_MINTED,
  };
  batchWriter.set(COL.COLLECTION, collection);

  if (placeholderNftId) {
    const placeholderNft = {
      uid: placeholderNftId,
      name: params.name,
      description: params.description,
      locked: false,
      media: params.placeholderUrl || null,
      availableFrom: params.availableFrom || null,
      price: params.price,
      availablePrice: params.price,
      collection: collection.uid,
      position: 0,
      lockedBy: null,
      ipfsMedia: null,
      approved: false,
      rejected: false,
      sold: true,
      soldOn: serverTime(),
      owner: null,
      space: params.space,
      type: params.type,
      hidden: true,
      placeholderNft: true,
      createdBy: owner,
      status: NftStatus.PRE_MINTED,
    };
    batchWriter.set(COL.NFT, placeholderNft);
  }
  await batchWriter.commit();

  return await Database.getById<Collection>(COL.COLLECTION, collection.uid);
};
