import { COL, Collection, Rank, SUB_COL, Token, WenError } from '@build-5/interfaces';
import { set } from 'lodash';
import { soonDb } from '../firebase/firestore/soondb';
import { hasStakedSoonTokens } from '../services/stake.service';
import { getRankingSpace } from '../utils/config.utils';
import { invalidArgument } from '../utils/error.utils';
import { assertIsGuardian } from '../utils/token.utils';

export const rankControl = async (owner: string, params: Record<string, unknown>) => {
  const hasStakedSoons = await hasStakedSoonTokens(owner);
  if (!hasStakedSoons) {
    throw invalidArgument(WenError.no_staked_soon);
  }

  const parentDocRef = soonDb().doc(`${params.collection}/${params.uid}`);
  const parent = await parentDocRef.get();
  if (!parent) {
    const errorMsg =
      params.collection === COL.COLLECTION
        ? WenError.collection_does_not_exists
        : WenError.token_does_not_exist;
    throw invalidArgument(errorMsg);
  }

  const rankingSpaceId = getRankingSpace(params.collection as COL);
  await assertIsGuardian(rankingSpaceId, owner);

  await soonDb().runTransaction(async (transaction) => {
    const parent = (await transaction.get<Collection | Token>(parentDocRef))!;
    const rankDocRef = parentDocRef.collection(SUB_COL.RANKS).doc(owner);
    const prevRank = await transaction.get<Rank | undefined>(rankDocRef);

    if (prevRank) {
      transaction.update(rankDocRef, { rank: params.rank });
    } else {
      transaction.create(rankDocRef, {
        uid: owner,
        parentCol: params.collection,
        parentId: params.uid,
        rank: params.rank,
      });
    }

    const ranks = {
      count: (parent.rankCount || 0) + (prevRank ? 0 : 1),
      sum: (parent.rankSum || 0) + (-(prevRank?.rank || 0) + (params.rank as number)),
      avg: 0,
    };
    set(ranks, 'avg', Number((ranks.sum / ranks.count).toFixed(3)));

    transaction.update(parentDocRef, {
      rankCount: ranks.count,
      rankSum: ranks.sum,
      rankAvg: ranks.avg,
    });

    const statsDocRef = parentDocRef.collection(SUB_COL.STATS).doc(params.uid as string);
    transaction.set(statsDocRef, { ranks }, true);
  });

  return await parentDocRef.collection(SUB_COL.RANKS).doc(owner).get<Rank>();
};
