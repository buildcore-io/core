import { build5Db } from '@build-5/database';
import { COL, Collection, RejectCollectionRequest, WenError } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsCollectionGuardian } from '../../utils/token.utils';
import { Context } from '../common';

export const rejectCollectionControl = async ({
  owner,
  params,
}: Context<RejectCollectionRequest>): Promise<Collection> => {
  const collectionDocRef = build5Db().doc(COL.COLLECTION, params.uid);
  const collection = await collectionDocRef.get();
  if (!collection) {
    throw invalidArgument(WenError.collection_does_not_exists);
  }

  if (!collection.availableFrom || dayjs(collection.availableFrom.toDate()).isBefore(dayjs())) {
    throw invalidArgument(WenError.collection_is_past_available_date);
  }

  if (collection.rejected) {
    throw invalidArgument(WenError.collection_is_already_rejected);
  }

  await assertIsCollectionGuardian(collection, owner);

  await collectionDocRef.update({ approved: false, rejected: true });
  return { ...collection, approved: false, rejected: true };
};
