import {
  COL,
  Collection,
  CollectionStatus,
  DiscountLine,
  Member,
  WenError,
} from '@soonaverse/interfaces';
import Joi from 'joi';
import { set } from 'lodash';
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

  const collectionUpdateData = { ...params, uid: params.uid as string };
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
  return await Database.getById<Collection>(COL.COLLECTION, params.uid as string);
};
