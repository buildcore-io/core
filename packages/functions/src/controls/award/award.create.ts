import { Award, AwardCreateRequest, COL, SUB_COL } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { createAward } from '../../services/payment/tangle-service/award/award.create.service';
import { Context } from '../common';

export const createAwardControl = async ({ owner, params }: Context<AwardCreateRequest>) => {
  const { owner: awardOwner, award } = await createAward(owner, params);

  const batch = build5Db().batch();

  const awardDocRef = build5Db().doc(`${COL.AWARD}/${award.uid}`);
  batch.create(awardDocRef, award);

  const ownerDocRef = awardDocRef.collection(SUB_COL.OWNERS).doc(owner);
  batch.create(ownerDocRef, awardOwner);

  await batch.commit();

  return await awardDocRef.get<Award>();
};
