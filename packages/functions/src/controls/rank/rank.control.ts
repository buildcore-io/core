import { IDocument, PgCollectionStatsUpdate, Update, build5Db } from '@build-5/database';
import { COL, RankRequest, SUB_COL, WenError } from '@build-5/interfaces';
import { hasStakedTokens } from '../../services/stake.service';
import { getRankingSpace } from '../../utils/config.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { Context } from '../common';

export const rankControl = async ({ owner, params, project }: Context<RankRequest>) => {
  const hasStakedSoons = await hasStakedTokens(project, owner);
  if (!hasStakedSoons) {
    throw invalidArgument(WenError.no_staked_soon);
  }

  const col = params.collection === 'collection' ? COL.COLLECTION : COL.TOKEN;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parentDocRef: IDocument<any, any, Update> = build5Db().doc(col, params.uid);
  const parent = await parentDocRef.get();
  if (!parent) {
    if (col === COL.COLLECTION) {
      throw invalidArgument(WenError.collection_does_not_exists);
    }
    throw invalidArgument(WenError.token_does_not_exist);
  }

  const rankingSpaceId = getRankingSpace(params.collection as COL);
  await assertIsGuardian(rankingSpaceId, owner);

  const rankDocRef = build5Db().doc(col, params.uid, SUB_COL.RANKS, owner);

  await build5Db().runTransaction(async (transaction) => {
    const parent = (await transaction.get(parentDocRef))!;
    const prevRank = await transaction.get(rankDocRef);

    await transaction.upsert(rankDocRef, {
      parentId: params.uid,
      rank: params.rank,
    });

    const count = (parent.rankCount || 0) + (prevRank ? 0 : 1);
    const sum = (parent.rankSum || 0) + (-(prevRank?.rank || 0) + params.rank);
    const ranks = { count, sum, avg: Number((sum / count).toFixed(3)) };

    await transaction.update(parentDocRef, {
      rankCount: ranks.count,
      rankSum: ranks.sum,
      rankAvg: ranks.avg,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statsDocRef: IDocument<any, any, PgCollectionStatsUpdate> = build5Db().doc(
      col,
      params.uid,
      SUB_COL.STATS,
      params.uid,
    );
    await transaction.upsert(statsDocRef, {
      project: parent.project,
      parentId: params.uid,
      ranks_avg: ranks.avg,
      ranks_sum: ranks.sum,
      ranks_count: ranks.count,
    });
  });

  return (await rankDocRef.get())!;
};
