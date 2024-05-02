import { COL, Vote } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgTokenVotes } from '../../models';
import { removeNulls } from '../common';

export class TokenVotesConverter implements Converter<Vote, PgTokenVotes> {
  toPg = (r: Vote): PgTokenVotes => ({
    uid: r.uid!,
    project: r.project,
    parentId: r.parentId,
    direction: r.direction,
  });

  fromPg = (pg: PgTokenVotes): Vote =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      parentId: pg.parentId,
      parentCol: COL.TOKEN,
      direction: pg.direction! as 1 | -1,
    });
}
