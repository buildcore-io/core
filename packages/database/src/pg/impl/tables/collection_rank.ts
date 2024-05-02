import { COL, Rank } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgCollectionRanks } from '../../models';
import { removeNulls } from '../common';

export class CollectionRankConverter implements Converter<Rank, PgCollectionRanks> {
  toPg = (r: Rank): PgCollectionRanks => ({
    uid: r.uid!,
    project: r.project,
    parentId: r.parentId,
    rank: r.rank,
  });

  fromPg = (pg: PgCollectionRanks): Rank =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      parentId: pg.parentId,
      parentCol: COL.COLLECTION,
      rank: pg.rank!,
    });
}
