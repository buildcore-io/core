import { database } from '@buildcore/database';
import { AwardCreateRequest, COL, SUB_COL } from '@buildcore/interfaces';
import { createAward } from '../../services/payment/tangle-service/award/award.create.service';
import { Context } from '../common';

export const createAwardControl = async ({
  owner,
  params,
  project,
}: Context<AwardCreateRequest>) => {
  const { owner: awardOwner, award } = await createAward(project, owner, params);

  const batch = database().batch();

  const awardDocRef = database().doc(COL.AWARD, award.uid);
  batch.create(awardDocRef, award);

  const ownerDocRef = database().doc(COL.AWARD, award.uid, SUB_COL.OWNERS, owner);
  batch.create(ownerDocRef, awardOwner);

  await batch.commit();

  return await awardDocRef.get();
};
