import { PgTokenPurchase, PgTokenStatsUpdate, database } from '@buildcore/database';
import { COL, SUB_COL } from '@buildcore/interfaces';
import { PgDocEvent } from '../common';

export const onTokenPurchaseCreated = async (event: PgDocEvent<PgTokenPurchase>) => {
  const { curr } = event;
  if (!curr || !curr.token) {
    return;
  }

  const statsDocRef = database().doc(COL.TOKEN, curr.token, SUB_COL.STATS, curr.token);
  const statsData: PgTokenStatsUpdate = {
    parentId: curr.token,
    volumeTotal: database().inc(curr.count!),
    volume_in24h: database().inc(curr.count!),
    volume_in48h: database().inc(curr.count!),
    volume_in7d: database().inc(curr.count!),
  };
  await statsDocRef.upsert(statsData);
};
