import { Award, COL, SUB_COL } from '@soonaverse/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { createAward } from '../../services/payment/tangle-service/award/award.create.service';

export const createAwardControl = async (owner: string, params: Record<string, unknown>) => {
  const { owner: awardOwner, award } = await createAward(owner, params);

  const batch = soonDb().batch();

  const awardDocRef = soonDb().doc(`${COL.AWARD}/${award.uid}`);
  batch.create(awardDocRef, award);

  const ownerDocRef = awardDocRef.collection(SUB_COL.OWNERS).doc(owner);
  batch.create(ownerDocRef, awardOwner);

  await batch.commit();

  return await awardDocRef.get<Award>();
};
