import { build5Db } from '@build-5/database';
import { COL, CollectionStats } from '@build-5/interfaces';
import { getRankingThreshold } from '../utils/config.utils';
import { FirestoreDocEvent } from './common';

export const onCollectionStatsWrite = async (event: FirestoreDocEvent<CollectionStats>) => {
  const { prev, curr } = event;
  if (!curr) {
    return;
  }

  if (rankingThresholdReached(prev, curr)) {
    await onRankingThresholdReached(event.docId);
  }
};

const rankingThresholdReached = (
  prev: CollectionStats | undefined,
  curr: CollectionStats | undefined,
) => {
  const rankingThreshold = getRankingThreshold();
  return (
    prev?.ranks &&
    curr?.ranks &&
    curr.ranks.sum < rankingThreshold &&
    prev.ranks.sum >= rankingThreshold
  );
};

const onRankingThresholdReached = async (collectionId: string) => {
  await build5Db().doc(`${COL.COLLECTION}/${collectionId}`).update({
    approved: false,
    rejected: true,
  });
};
