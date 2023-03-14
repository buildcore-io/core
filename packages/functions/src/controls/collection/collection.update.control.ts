import {
  COL,
  Collection,
  CollectionStatus,
  DiscountLine,
  Member,
  Nft,
  NftStatus,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { isEmpty, set } from 'lodash';
import { Database } from '../../database/Database';
import {
  updateCollectionSchema,
  updateMintedCollectionSchema,
} from '../../runtime/firebase/collection';
import { CommonJoi } from '../../services/joi/common';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { populateTokenUidOnDiscounts } from './common';

export const updateCollectionControl = async (owner: string, params: Record<string, unknown>) => {
  const collection = await Database.getById<Collection>(COL.COLLECTION, params.uid as string);
  if (!collection) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  const isMinted = collection.status === CollectionStatus.MINTED;
  const updateSchemaObj = isMinted ? updateMintedCollectionSchema : updateCollectionSchema;
  const schema = Joi.object({ uid: CommonJoi.uid(), ...updateSchemaObj });
  await assertValidationAsync(schema, params);

  const member = await Database.getById<Member>(COL.MEMBER, owner);
  if (!member) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  if (params.availableFrom) {
    if (dayjs().isAfter(collection.availableFrom.toDate())) {
      throw throwInvalidArgument(WenError.available_from_must_be_in_the_future);
    }
    params.availableFrom = dateToTimestamp(params.availableFrom as Date, true);
  }

  if (!collection.approved && collection.createdBy !== owner) {
    throw throwInvalidArgument(WenError.you_must_be_the_creator_of_this_collection);
  }

  if (collection.royaltiesFee < (params.royaltiesFee as number)) {
    throw throwInvalidArgument(WenError.royalty_fees_can_only_be_reduced);
  }

  await assertIsGuardian(collection.space, owner);

  const batchWriter = Database.createBatchWriter();

  const price = (params.price as number) || collection.price;
  const collectionUpdateData = {
    ...params,
    price,
    availablePrice: price,
    uid: params.uid as string,
  };
  const discounts = <DiscountLine[] | undefined>params.discounts;
  if (discounts) {
    set(collectionUpdateData, 'discounts', await populateTokenUidOnDiscounts(discounts));
  }
  batchWriter.update(COL.COLLECTION, collectionUpdateData);

  if (!isMinted && collection.placeholderNft) {
    const data = {
      uid: collection.placeholderNft,
      name: params.name || '',
      description: params.description || '',
      media: params.placeholderUrl || '',
      space: collection.space,
      type: collection.type,
    };
    batchWriter.update(COL.NFT, data);
  }
  await batchWriter.commit();

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
      await Database.getManyPaginated<Nft>(
        COL.NFT,
        { collection: collection.uid, isOwned: false, status },
        500,
      )(updateNftsPrice(nftUpdateData));
    }
  }

  return await Database.getById<Collection>(COL.COLLECTION, params.uid as string);
};

const updateNftsPrice = (data: Record<string, unknown>) => async (nfts: Nft[]) => {
  const batchWriter = Database.createBatchWriter();
  for (const nft of nfts) {
    batchWriter.update(COL.NFT, { uid: nft.uid, ...data });
  }
  await batchWriter.commit();
};
