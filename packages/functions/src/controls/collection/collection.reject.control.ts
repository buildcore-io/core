import { COL, Collection, WenError } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../database/wrapper/soondb';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';

export const rejectCollectionControl = async (owner: string, params: Record<string, unknown>) => {
  const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${params.uid}`);
  const collection = await collectionDocRef.get<Collection>();
  if (!collection) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  if (!collection.availableFrom || dayjs(collection.availableFrom.toDate()).isBefore(dayjs())) {
    throw throwInvalidArgument(WenError.collection_is_past_available_date);
  }

  if (collection.rejected) {
    throw throwInvalidArgument(WenError.collection_is_already_rejected);
  }

  await assertIsGuardian(collection.space, owner);

  await collectionDocRef.update({ approved: false, rejected: true });
  return { ...collection, approved: false, rejected: true };
};
