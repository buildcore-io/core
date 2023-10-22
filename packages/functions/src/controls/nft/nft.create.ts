import { build5Db } from '@build-5/database';
import {
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  MIN_IOTA_AMOUNT,
  Nft,
  NftAccess,
  NftCreateRequest,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';

export const createNftControl = async ({
  owner,
  params,
}: Context<NftCreateRequest>): Promise<Nft> => {
  const collection = await getCollection(owner, params.collection as string);
  return await processOneCreateNft(params, collection, collection.total + 1);
};

export const createBatchNftControl = async ({
  owner,
  params,
}: Context<NftCreateRequest[]>): Promise<string[]> => {
  const collection = await getCollection(owner, params[0].collection);
  const promises = params.map((param, i) =>
    processOneCreateNft(param, collection, collection.total + i + 1),
  );
  return (await Promise.all(promises)).map((n) => n.uid);
};

const getCollection = async (owner: string, collectionId: string) => {
  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${collectionId}`);
  const collection = await collectionDocRef.get<Collection>();
  if (!collection) {
    throw invalidArgument(WenError.collection_does_not_exists);
  }

  if ((collection.status || CollectionStatus.PRE_MINTED) !== CollectionStatus.PRE_MINTED) {
    throw invalidArgument(WenError.invalid_collection_status);
  }

  if (collection.rejected) {
    throw invalidArgument(WenError.collection_is_already_rejected);
  }

  if (collection.approved === true && collection.limitedEdition) {
    throw invalidArgument(WenError.this_is_limited_addition_collection);
  }

  if (collection.createdBy !== owner) {
    throw invalidArgument(WenError.you_must_be_the_creator_of_this_collection);
  }

  return collection;
};

const processOneCreateNft = async (
  params: NftCreateRequest,
  collection: Collection,
  position: number,
) => {
  if (params.availableFrom) {
    params.availableFrom = dateToTimestamp(params.availableFrom, true).toDate();
  }

  if (
    !collection.availableFrom ||
    dayjs(collection.availableFrom.toDate()).isAfter(dayjs(params.availableFrom), 'minutes')
  ) {
    throw invalidArgument(
      WenError.nft_date_must_be_after_or_same_with_collection_available_from_date,
    );
  }

  if (collection.type === CollectionType.CLASSIC) {
    const availableFrom = dayjs(params.availableFrom);
    const expectedAvailableFrom = dayjs().subtract(24 * 60 * 60 * 1000);
    if (availableFrom.isBefore(expectedAvailableFrom)) {
      throw invalidArgument(WenError.available_from_must_be_in_the_future);
    }
  }

  if (!isEmpty(params.saleAccessMembers) && collection.type !== CollectionType.CLASSIC) {
    throw invalidArgument(WenError.collection_must_be_classic);
  }

  if (collection.type === CollectionType.GENERATED || collection.type === CollectionType.SFT) {
    params.price = collection.price || 0;
    params.availableFrom = (collection.availableFrom || collection.createdOn).toDate();
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
  const batch = build5Db().batch();
  const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
  batch.create(nftDocRef, nft);

  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${collection.uid}`);
  batch.update(collectionDocRef, { total: build5Db().inc(1) });

  if (collection.placeholderNft) {
    const placeholderNftDocRef = build5Db().doc(`${COL.NFT}/${collection.placeholderNft}`);
    batch.update(placeholderNftDocRef, {
      sold: false,
      availableFrom: params.availableFrom,
      hidden: false,
    });
  }
  await batch.commit();

  return (await nftDocRef.get<Nft>())!;
};
