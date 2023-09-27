import { build5Db } from '@build-5/database';
import { Award, AwardCreateRequest, COL, SUB_COL } from '@build-5/interfaces';
import { Context } from '../../runtime/firebase/common';
import { createAward } from '../../services/payment/tangle-service/award/award.create.service';

export const createAwardControl = async (
  { project, owner }: Context,
  params: AwardCreateRequest,
) => {
  const { owner: awardOwner, award } = await createAward(project, owner, params);

  const batch = build5Db().batch();

  const awardDocRef = build5Db().doc(`${COL.AWARD}/${award.uid}`);
  batch.create(awardDocRef, award);

  const ownerDocRef = awardDocRef.collection(SUB_COL.OWNERS).doc(owner);
  batch.create(ownerDocRef, awardOwner);

  await batch.commit();

  return await awardDocRef.get<Award>();
};
