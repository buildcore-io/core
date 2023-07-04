import { COL, Collection, Rank, RankRequest, SUB_COL, Token, WenError } from '@build-5/interfaces';
import { set } from 'lodash';
import { build5Db } from '../firebase/firestore/build5Db';
import { hasStakedSoonTokens } from '../services/stake.service';
import { getRankingSpace } from '../utils/config.utils';
import { invalidArgument } from '../utils/error.utils';
import { assertIsGuardian } from '../utils/token.utils';

export const rankControl = async (owner: string, params: RankRequest) => {
  const hasStakedSoons = await hasStakedSoonTokens(owner);
  if (!hasStakedSoons) {
    throw invalidArgument(WenError.no_staked_soon);
  }

  const parentDocRef = build5Db().doc(`${params.collection}/${params.uid}`);
  const parent = await parentDocRef.get();
  if (!parent) {
    const errorMsg =
      params.collection === COL.COLLECTION
        ? WenError.collection_does_not_exists
        : WenError.token_does_not_exist;
    throw invalidArgument(errorMsg);
  }

  const rankingSpaceId = getRankingSpace(params.collection);
  await assertIsGuardian(rankingSpaceId, owner);

  await build5Db().runTransaction(async (transaction) => {
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
      sum: (parent.rankSum || 0) + (-(prevRank?.rank || 0) + params.rank),
      avg: 0,
    };
    set(ranks, 'avg', Number((ranks.sum / ranks.count).toFixed(3)));

    transaction.update(parentDocRef, {
      rankCount: ranks.count,
      rankSum: ranks.sum,
      rankAvg: ranks.avg,
    });

    const statsDocRef = parentDocRef.collection(SUB_COL.STATS).doc(params.uid);
    transaction.set(statsDocRef, { ranks }, true);
  });

  const rankDocRef = parentDocRef.collection(SUB_COL.RANKS).doc(owner);
  return (await rankDocRef.get<Rank>())!;
};
