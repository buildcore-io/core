import { ApproveCollectionRequest, COL, Collection, WenError } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';

export const approveCollectionControl = async (
  owner: string,
  params: ApproveCollectionRequest,
): Promise<Collection> => {
  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${params.uid}`);
  const collection = await collectionDocRef.get<Collection>();
  if (!collection) {
    throw invalidArgument(WenError.collection_does_not_exists);
  }

  if (collection.approved) {
    throw invalidArgument(WenError.collection_is_already_approved);
  }

  if (collection.rejected) {
    throw invalidArgument(WenError.collection_is_already_rejected);
  }

  await assertIsGuardian(collection.space, owner);

  await collectionDocRef.update({ approved: true });
  return { ...collection, approved: true };
};
