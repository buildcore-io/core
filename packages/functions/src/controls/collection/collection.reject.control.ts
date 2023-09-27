import { build5Db } from '@build-5/database';
import { COL, Collection, RejectCollectionRequest, WenError } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { Context } from '../../runtime/firebase/common';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';

export const rejectCollectionControl = async (
  { owner }: Context,
  params: RejectCollectionRequest,
): Promise<Collection> => {
  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${params.uid}`);
  const collection = await collectionDocRef.get<Collection>();
  if (!collection) {
    throw invalidArgument(WenError.collection_does_not_exists);
  }

  if (!collection.availableFrom || dayjs(collection.availableFrom.toDate()).isBefore(dayjs())) {
    throw invalidArgument(WenError.collection_is_past_available_date);
  }

  if (collection.rejected) {
    throw invalidArgument(WenError.collection_is_already_rejected);
  }

  await assertIsGuardian(collection.space, owner);

  await collectionDocRef.update({ approved: false, rejected: true });
  return { ...collection, approved: false, rejected: true };
};
