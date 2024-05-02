import { build5Db } from '@build-5/database';
import { AwardCreateRequest, COL, SUB_COL } from '@build-5/interfaces';
import { createAward } from '../../services/payment/tangle-service/award/award.create.service';
import { Context } from '../common';

export const createAwardControl = async ({
  owner,
  params,
  project,
}: Context<AwardCreateRequest>) => {
  const { owner: awardOwner, award } = await createAward(project, owner, params);

  const batch = build5Db().batch();

  const awardDocRef = build5Db().doc(COL.AWARD, award.uid);
  batch.create(awardDocRef, award);

  const ownerDocRef = build5Db().doc(COL.AWARD, award.uid, SUB_COL.OWNERS, owner);
  batch.create(ownerDocRef, awardOwner);

  await batch.commit();

  return await awardDocRef.get();
};
