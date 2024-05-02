import { PgCollectionStats, build5Db } from '@build-5/database';
import { COL } from '@build-5/interfaces';
import { getRankingThreshold } from '../utils/config.utils';
import { PgDocEvent } from './common';

export const onCollectionStatsWrite = async (event: PgDocEvent<PgCollectionStats>) => {
  const { prev, curr } = event;
  if (!curr) {
    return;
  }

  if (rankingThresholdReached(prev, curr)) {
    await build5Db().doc(COL.COLLECTION, event.uid).update({ approved: false, rejected: true });
  }
};

const rankingThresholdReached = (
  prev: PgCollectionStats | undefined,
  curr: PgCollectionStats | undefined,
) => {
  const rankingThreshold = getRankingThreshold();
  return (
    prev?.ranks_sum &&
    curr?.ranks_sum &&
    curr.ranks_sum < rankingThreshold &&
    prev.ranks_sum >= rankingThreshold
  );
};
