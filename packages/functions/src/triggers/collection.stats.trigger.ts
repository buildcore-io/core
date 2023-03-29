import { COL, CollectionStats, SUB_COL, WEN_FUNC } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { soonDb } from '../firebase/firestore/soondb';
import { scale } from '../scale.settings';
import { getRankingThreshold } from '../utils/config.utils';

export const collectionStatsUpdate = functions
  .runWith({
    minInstances: scale(WEN_FUNC.collectionStatsUpdate),
  })
  .firestore.document(`${COL.COLLECTION}/{collectionId}/${SUB_COL.STATS}/{subDocId}`)
  .onWrite(async (change, context) => {
    const prev = <CollectionStats | undefined>change.before.data();
    const curr = <CollectionStats | undefined>change.after.data();
    if (!curr) {
      return;
    }

    if (rankingThresholdReached(prev, curr)) {
      await onRankingThresholdReached(context.params.collectionId);
    }
  });

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
