import { Award, COL, SUB_COL, WenError } from '@soonaverse/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { throwInvalidArgument } from '../../utils/error.utils';

export const addOwnerControl = async (owner: string, params: Record<string, unknown>) => {
  const awardDocRef = soonDb().doc(`${COL.AWARD}/${params.uid}`);
  const award = await awardDocRef.get<Award>();
  if (!award) {
    throw throwInvalidArgument(WenError.award_does_not_exists);
  }

  const awardOwner = await awardDocRef.collection(SUB_COL.OWNERS).doc(owner).get();
  if (!awardOwner) {
    throw throwInvalidArgument(WenError.you_are_not_owner_of_the_award);
  }

  const awardMember = await awardDocRef
    .collection(SUB_COL.OWNERS)
    .doc(params.member as string)
    .get();
  if (awardMember) {
    throw throwInvalidArgument(WenError.member_is_already_owner_of_space);
  }

  const newOwner = { uid: params.member as string, parentId: award.uid, parentCol: COL.AWARD };
  await awardDocRef
    .collection(SUB_COL.OWNERS)
    .doc(params.member as string)
    .create(newOwner);
  return newOwner;
};
