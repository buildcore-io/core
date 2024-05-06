import { database } from '@buildcore/database';
import {
  COL,
  CollectionStatus,
  NftStatus,
  UpdateCollectionRequest,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { isEmpty, set } from 'lodash';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { assertIsCollectionGuardian } from '../../utils/token.utils';
import { Context, UidSchemaObject } from '../common';
import { updateMintedCollectionSchemaObject } from './CollectionUpdateMintedRequestSchema';
import { updateCollectionSchemaObject } from './CollectionUpdateRequestSchema';
import { populateTokenUidOnDiscounts } from './common';

export const updateCollectionControl = async ({
  owner,
  params: rawParams,
}: Context<UidSchemaObject>) => {
  const collectionDocRef = database().doc(COL.COLLECTION, rawParams.uid);
  const collection = await collectionDocRef.get();
  if (!collection) {
    throw invalidArgument(WenError.collection_does_not_exists);
  }

  const isMinted = collection.status === CollectionStatus.MINTED;
  const schema = isMinted ? updateMintedCollectionSchemaObject : updateCollectionSchemaObject;
  const { discounts, ...params } = await assertValidationAsync(schema, rawParams);

  const member = await database().doc(COL.MEMBER, owner).get();
  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  if (params.availableFrom) {
    if (dayjs().isAfter(collection.availableFrom.toDate())) {
      throw invalidArgument(WenError.available_from_must_be_in_the_future);
    }
    params.availableFrom = dateToTimestamp(params.availableFrom, true).toDate();
  }

  if (!collection.approved && collection.createdBy !== owner) {
    throw invalidArgument(WenError.you_must_be_the_creator_of_this_collection);
  }

  if (collection.royaltiesFee < (params as UpdateCollectionRequest).royaltiesFee) {
    throw invalidArgument(WenError.royalty_fees_can_only_be_reduced);
  }

  await assertIsCollectionGuardian(collection, owner);

  const batch = database().batch();

  const price = (params.price as number) || collection.price;
  const collectionUpdateData = {
    ...params,
    price,
    availablePrice: price,
    access: params.access,
    uid: params.uid,
  };
  if (!params.access) {
    delete collectionUpdateData.access;
  }
  if (discounts) {
    const value = JSON.stringify(await populateTokenUidOnDiscounts(discounts));
    set(collectionUpdateData, 'discounts', value);
  }
  batch.update(collectionDocRef, collectionUpdateData);

  if (!isMinted && collection.placeholderNft) {
    const data = {
      name: (params as UpdateCollectionRequest).name || '',
      description: (params as UpdateCollectionRequest).description || '',
      media: (params as UpdateCollectionRequest).placeholderUrl || '',
      space: collection.space,
      type: collection.type,
    };
    const nftDocRef = database().doc(COL.NFT, collection.placeholderNft);
    batch.update(nftDocRef, data);
  }
  await batch.commit();

  const nftUpdateData = {};
  if (price !== collection.price) {
    set(nftUpdateData, 'price', price);
    set(nftUpdateData, 'availablePrice', price);
  }
  if (params.availableFrom) {
    set(nftUpdateData, 'availableFrom', params.availableFrom);
  }
  if (!isEmpty(nftUpdateData)) {
    for (const status of [NftStatus.PRE_MINTED, NftStatus.MINTED]) {
      await database()
        .collection(COL.NFT)
        .update(nftUpdateData, { collection: collection.uid, isOwned: false, status: status });
    }
  }

  return await database().doc(COL.COLLECTION, params.uid).get();
};
