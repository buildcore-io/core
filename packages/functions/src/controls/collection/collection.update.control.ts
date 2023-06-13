import {
  COL,
  Collection,
  CollectionStatus,
  DiscountLine,
  Member,
  Nft,
  NftStatus,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { isEmpty, last, set } from 'lodash';
import { build5Db, getSnapshot } from '../../firebase/firestore/build5Db';
import {
  updateCollectionSchema,
  updateMintedCollectionSchema,
} from '../../runtime/firebase/collection';
import { CommonJoi } from '../../services/joi/common';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { populateTokenUidOnDiscounts } from './common';

export const updateCollectionControl = async (owner: string, params: Record<string, unknown>) => {
  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${params.uid}`);
  const collection = await collectionDocRef.get<Collection>();
  if (!collection) {
    throw invalidArgument(WenError.collection_does_not_exists);
  }

  const isMinted = collection.status === CollectionStatus.MINTED;
  const updateSchemaObj = isMinted ? updateMintedCollectionSchema : updateCollectionSchema;
  const schema = Joi.object({ uid: CommonJoi.uid(), ...updateSchemaObj });
  await assertValidationAsync(schema, params);

  const member = await build5Db().doc(`${COL.MEMBER}/${owner}`).get<Member>();
  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  if (params.availableFrom) {
    if (dayjs().isAfter(collection.availableFrom.toDate())) {
      throw invalidArgument(WenError.available_from_must_be_in_the_future);
    }
    params.availableFrom = dateToTimestamp(params.availableFrom as Date, true);
  }

  if (!collection.approved && collection.createdBy !== owner) {
    throw invalidArgument(WenError.you_must_be_the_creator_of_this_collection);
  }

  if (collection.royaltiesFee < (params.royaltiesFee as number)) {
    throw invalidArgument(WenError.royalty_fees_can_only_be_reduced);
  }

  await assertIsGuardian(collection.space, owner);

  const batch = build5Db().batch();

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

  batch.update(collectionDocRef, collectionUpdateData);

  if (!isMinted && collection.placeholderNft) {
    const data = {
      name: params.name || '',
      description: params.description || '',
      media: params.placeholderUrl || '',
      space: collection.space,
      type: collection.type,
    };
    const nftDocRef = build5Db().doc(`${COL.NFT}/${collection.placeholderNft}`);
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
      let lastNftId = '';
      do {
        const lastDoc = await getSnapshot(COL.NFT, lastNftId);
        const nfts = await build5Db()
          .collection(COL.NFT)
          .where('collection', '==', collection.uid)
          .where('isOwned', '==', false)
          .where('status', '==', status)
          .limit(500)
          .startAfter(lastDoc)
          .get<Nft>();
        lastNftId = last(nfts)?.uid || '';

        const batch = build5Db().batch();
        for (const nft of nfts) {
          batch.update(build5Db().doc(`${COL.NFT}/${nft.uid}`), nftUpdateData);
        }
        await batch.commit();
      } while (lastNftId);
    }
  }

  return await build5Db().doc(`${COL.COLLECTION}/${params.uid}`).get();
};
