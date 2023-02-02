import { COL, Collection, Member, WenError } from '@soonaverse/interfaces';
import { Database } from '../../database/Database';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';

export const approveCollectionControl = async (owner: string, params: Record<string, unknown>) => {
  const member = await Database.getById<Member>(COL.MEMBER, owner);
  if (!member) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const collection = await Database.getById<Collection>(COL.COLLECTION, params.uid as string);
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

  await Database.update(COL.COLLECTION, { uid: collection.uid, approved: true });
  return { ...collection, approved: true };
};
