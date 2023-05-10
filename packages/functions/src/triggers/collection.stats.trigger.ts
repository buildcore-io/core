import { COL, CollectionStats, SUB_COL } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions/v2';
import { soonDb } from '../firebase/firestore/soondb';
import { getRankingThreshold } from '../utils/config.utils';

export const collectionStatsUpdate = functions.firestore.onDocumentWritten(
  { document: `${COL.COLLECTION}/{collectionId}/${SUB_COL.STATS}/{subDocId}`, concurrency: 1000 },
  async (event) => {
    const prev = <CollectionStats | undefined>event.data?.before?.data();
    const curr = <CollectionStats | undefined>event.data?.after?.data();
    if (!curr) {
      return;
    }

    if (rankingThresholdReached(prev, curr)) {
      await onRankingThresholdReached(event.params.collectionId);
    }
  },
);

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
  await soonDb().doc(`${COL.COLLECTION}/${collectionId}`).update({
    approved: false,
    rejected: true,
  });
};
