import { AwardOwner, COL } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgAwardOwners } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class AwardOwnerConverter implements Converter<AwardOwner, PgAwardOwners> {
  toPg = (awardOwner: AwardOwner): PgAwardOwners => ({
    uid: awardOwner.uid,
    project: awardOwner.project,
    createdOn: awardOwner.createdOn?.toDate(),
    parentId: awardOwner.parentId,
  });

  fromPg = (pg: PgAwardOwners): AwardOwner =>
    removeNulls({
      project: pg.project,
      parentId: pg.parentId,
      parentCol: COL.AWARD,
      uid: pg.uid,
      createdOn: pgDateToTimestamp(pg.createdOn),
    });
}
