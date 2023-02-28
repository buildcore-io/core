import { Award, COL, SUB_COL } from '@soonaverse/interfaces';
import { Database } from '../../database/Database';
import { createAward } from '../../services/payment/tangle-service/award/award.create.service';

export const createAwardControl = async (owner: string, params: Record<string, unknown>) => {
  const { owner: awardOwner, award } = await createAward(owner, params);

  const batchWriter = Database.createBatchWriter();
  batchWriter.set(COL.AWARD, award);
  batchWriter.set(COL.AWARD, awardOwner, SUB_COL.OWNERS, award.uid);
  await batchWriter.commit();

  return await Database.getById<Award>(COL.AWARD, award.uid);
};
