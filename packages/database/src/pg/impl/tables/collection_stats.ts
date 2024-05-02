import { COL, CollectionStats } from '@build-5/interfaces';
import { Converter } from '../../interfaces/common';
import { PgCollectionStats } from '../../models';
import { removeNulls } from '../common';

export class CollectionStatsConverter implements Converter<CollectionStats, PgCollectionStats> {
  toPg = (s: CollectionStats): PgCollectionStats => ({
    uid: s.uid!,
    project: s.project,
    parentId: s.parentId,
    votes_upvotes: s.votes?.upvotes,
    votes_downvotes: s.votes?.downvotes,
    votes_voteDiff: s.votes?.voteDiff,
    ranks_count: s.ranks?.count,
    ranks_sum: s.ranks?.sum,
    ranks_avg: s.ranks?.avg,
  });

  fromPg = (pg: PgCollectionStats): CollectionStats =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      parentId: pg.parentId,
      parentCol: COL.COLLECTION,
      votes: {
        upvotes: pg.votes_upvotes || 0,
        downvotes: pg.votes_downvotes || 0,
        voteDiff: pg.votes_voteDiff || 0,
      },
      ranks: {
        count: pg.ranks_count || 0,
        sum: pg.ranks_sum || 0,
        avg: pg.ranks_avg || 0,
      },
    });
}
