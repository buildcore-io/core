import { COL, Collection, WenError } from '@soonaverse/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';

export const approveCollectionControl = async (owner: string, params: Record<string, unknown>) => {
  const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${params.uid}`);
  const collection = await collectionDocRef.get<Collection>();
  if (!collection) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  if (collection.approved) {
    throw throwInvalidArgument(WenError.collection_is_already_approved);
  }

  if (collection.rejected) {
    throw throwInvalidArgument(WenError.collection_is_already_rejected);
  }

  await assertIsGuardian(collection.space, owner);

  await collectionDocRef.update({ approved: true });
  return { ...collection, approved: true };
};
