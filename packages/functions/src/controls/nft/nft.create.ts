import {
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  MIN_IOTA_AMOUNT,
  Nft,
  NftAccess,
  NftAvailableFromDateMin,
  Timestamp,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { soonDb } from '../../database/wrapper/soondb';
import { isProdEnv } from '../../utils/config.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const createNftControl = async (owner: string, params: Record<string, unknown>) => {
  const collection = await getCollection(owner, params.collection as string);
  return await processOneCreateNft(params, collection, collection.total + 1);
};

export const createBatchNftControl = async (owner: string, params: Record<string, unknown>[]) => {
  const collection = await getCollection(owner, params[0].collection as string);
  const promises = params.map((param, i) =>
    processOneCreateNft(param, collection, collection.total + i + 1),
  );
  return (await Promise.all(promises)).map((n) => n.uid);
};

const getCollection = async (owner: string, collectionId: string) => {
  const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${collectionId}`);
  const collection = await collectionDocRef.get<Collection>();
  if (!collection) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  if ((collection.status || CollectionStatus.PRE_MINTED) !== CollectionStatus.PRE_MINTED) {
    throw throwInvalidArgument(WenError.invalid_collection_status);
  }

  if (collection.rejected) {
    throw throwInvalidArgument(WenError.collection_is_already_rejected);
  }

  if (collection.approved === true && collection.limitedEdition) {
    throw throwInvalidArgument(WenError.this_is_limited_addition_collection);
  }

  if (collection.createdBy !== owner) {
    throw throwInvalidArgument(WenError.you_must_be_the_creator_of_this_collection);
  }

  return collection;
};

const processOneCreateNft = async (
  params: Record<string, unknown>,
  collection: Collection,
  position: number,
) => {
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

  if (collection.type === CollectionType.CLASSIC) {
    const availableFrom = dayjs((params.availableFrom as Timestamp).toDate());
    const expectedAvailableFrom = dayjs().add(
      isProdEnv() ? NftAvailableFromDateMin.value : -NftAvailableFromDateMin.value,
    );
    if (availableFrom.isBefore(expectedAvailableFrom)) {
      throw throwInvalidArgument(WenError.available_from_must_be_in_the_future);
    }
  }

  if (!isEmpty(params.saleAccessMembers) && collection.type !== CollectionType.CLASSIC) {
    throw throwInvalidArgument(WenError.collection_must_be_classic);
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
    saleAccess: isEmpty(params.saleAccessMembers) ? NftAccess.OPEN : NftAccess.MEMBERS,
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
    createdBy: collection.createdBy,
    placeholderNft: false,
    status: CollectionStatus.PRE_MINTED,
  };
  const batch = soonDb().batch();
  const nftDocRef = soonDb().doc(`${COL.NFT}/${nft.uid}`);
  batch.create(nftDocRef, nft);

  const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${collection.uid}`);
  batch.update(collectionDocRef, { total: soonDb().inc(1) });

  if (collection.placeholderNft) {
    const placeholderNftDocRef = soonDb().doc(`${COL.NFT}/${collection.placeholderNft}`);
    batch.update(placeholderNftDocRef, {
      sold: false,
      availableFrom: params.availableFrom,
      hidden: false,
    });
  }
  await batch.commit();

  return (await nftDocRef.get<Nft>())!;
};
