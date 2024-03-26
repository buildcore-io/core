import { COL, Vote } from '@build-5/interfaces';
import { Converter } from '../../interfaces/common';
import { PgCollectionVotes } from '../../models';
import { removeNulls } from '../common';

export class CollectionVotesConverter implements Converter<Vote, PgCollectionVotes> {
  toPg = (r: Vote): PgCollectionVotes => ({
    uid: r.uid!,
    project: r.project,
    parentId: r.parentId,
    direction: r.direction,
  });

  fromPg = (pg: PgCollectionVotes): Vote =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      parentId: pg.parentId,
      parentCol: COL.COLLECTION,
      direction: pg.direction! as 1 | -1,
    });
}
