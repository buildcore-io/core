import {
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  Member,
  MIN_IOTA_AMOUNT,
  Nft,
  NftAccess,
  Timestamp,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { Database } from '../../database/Database';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const createNftControl = async (owner: string, params: Record<string, unknown>) => {
  const collection = await Database.getById<Collection>(
    COL.COLLECTION,
    params.collection as string,
  );
  if (!collection) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }
  if (collection.status !== CollectionStatus.PRE_MINTED) {
    throw throwInvalidArgument(WenError.invalid_collection_status);
  }
  const member = await Database.getById<Member>(COL.MEMBER, owner);
  return await processOneCreateNft(member, params, collection, collection.total + 1);
};

export const createBatchNftControl = async (owner: string, params: Record<string, unknown>[]) => {
  const collection = await Database.getById<Collection>(
    COL.COLLECTION,
    params[0].collection as string,
  );
  if (!collection) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }
  if ((collection.status || CollectionStatus.PRE_MINTED) !== CollectionStatus.PRE_MINTED) {
    throw throwInvalidArgument(WenError.invalid_collection_status);
  }

  const member = await Database.getById<Member>(COL.MEMBER, owner);
  const promises = params.map((param, i) =>
    processOneCreateNft(member, param, collection, collection.total + i + 1),
  );
  return (await Promise.all(promises)).map((n) => n.uid);
};

const processOneCreateNft = async (
  member: Member | undefined,
  params: Record<string, unknown>,
  collection: Collection,
  position: number,
) => {
  if (!member) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  if (collection.createdBy !== member.uid) {
    throw throwInvalidArgument(WenError.you_must_be_the_creator_of_this_collection);
  }

  if (params.availableFrom) {
    params.availableFrom = dateToTimestamp(params.availableFrom as Date, true);
  }

  if (
    !collection.availableFrom ||
    dayjs(collection.availableFrom.toDate()).isAfter(dayjs(params.availableFrom as Date), 'minutes')
  ) {
    throw throwInvalidArgument(
      WenError.nft_date_must_be_after_or_same_with_collection_available_from_date,
    );
  }

  if (collection.rejected) {
    throw throwInvalidArgument(WenError.collection_is_already_rejected);
  }

  if (collection.approved === true && collection.limitedEdition) {
    throw throwInvalidArgument(WenError.this_is_limited_addition_collection);
  }

  if (collection.type === CollectionType.CLASSIC) {
    const availableFrom = dayjs((params.availableFrom as Timestamp).toDate());
    const expectedAvailableFrom = dayjs().subtract(24 * 60 * 60 * 1000);
    if (availableFrom.isBefore(expectedAvailableFrom)) {
      throw throwInvalidArgument(WenError.available_from_must_be_in_the_future);
    }
  }

  if (collection.type === CollectionType.GENERATED || collection.type === CollectionType.SFT) {
    params.price = collection.price || 0;
    params.availableFrom = collection.availableFrom || collection.createdOn;
  }

  const price = Math.max(Number(params.price) || 0, MIN_IOTA_AMOUNT);
  const nft = {
    ...params,
    uid: getRandomEthAddress(),
    locked: false,
    price,
    availablePrice: price,
    saleAccess: NftAccess.OPEN,
    position,
    lockedBy: null,
    ipfsMedia: null,
    ipfsMetadata: null,
    sold: false,
    approved: collection.approved,
    rejected: collection.rejected,
    owner: null,
    isOwned: false,
    soldOn: null,
    ipfsRetries: 0,
    space: collection.space,
    type: collection.type,
    hidden: CollectionType.CLASSIC !== collection.type,
    createdBy: member.uid,
    placeholderNft: false,
    status: CollectionStatus.PRE_MINTED,
  };
  await Database.create(COL.NFT, nft);

  await Database.update(COL.COLLECTION, { uid: collection.uid, total: Database.inc(1) });

  if (collection.placeholderNft) {
    await Database.update(COL.NFT, {
      uid: collection.placeholderNft,
      sold: false,
      availableFrom: params.availableFrom,
      hidden: false,
    });
  }

  return (await Database.getById<Nft>(COL.NFT, nft.uid))!;
};
