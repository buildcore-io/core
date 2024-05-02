import { PgTokenPurchase, PgTokenStatsUpdate, build5Db } from '@build-5/database';
import { COL, SUB_COL } from '@build-5/interfaces';
import { PgDocEvent } from '../common';

export const onTokenPurchaseCreated = async (event: PgDocEvent<PgTokenPurchase>) => {
  const { curr } = event;
  if (!curr || !curr.token) {
    return;
  }

  const statsDocRef = build5Db().doc(COL.TOKEN, curr.token, SUB_COL.STATS, curr.token);
  const statsData: PgTokenStatsUpdate = {
    parentId: curr.token,
    volumeTotal: build5Db().inc(curr.count!),
    volume_in24h: build5Db().inc(curr.count!),
    volume_in48h: build5Db().inc(curr.count!),
    volume_in7d: build5Db().inc(curr.count!),
  };
  await statsDocRef.upsert(statsData);
};
