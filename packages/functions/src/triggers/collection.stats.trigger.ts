import { PgCollectionStats, database } from '@buildcore/database';
import { COL } from '@buildcore/interfaces';
import { getRankingThreshold } from '../utils/config.utils';
import { PgDocEvent } from './common';

export const onCollectionStatsWrite = async (event: PgDocEvent<PgCollectionStats>) => {
  const { prev, curr } = event;
  if (!curr) {
    return;
  }

  if (rankingThresholdReached(prev, curr)) {
    await database().doc(COL.COLLECTION, event.uid).update({ approved: false, rejected: true });
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
