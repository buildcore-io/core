import { COL, Rank } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgTokenRanks } from '../../models';
import { removeNulls } from '../common';

export class TokenRankConverter implements Converter<Rank, PgTokenRanks> {
  toPg = (r: Rank): PgTokenRanks => ({
    uid: r.uid!,
    project: r.project,
    parentId: r.parentId,
    rank: r.rank,
  });

  fromPg = (pg: PgTokenRanks): Rank =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      parentId: pg.parentId,
      parentCol: COL.TOKEN,
      rank: pg.rank!,
    });
}
