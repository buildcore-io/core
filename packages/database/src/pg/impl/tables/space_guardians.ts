import { COL, SpaceGuardian } from '@build-5/interfaces';
import { Converter } from '../../interfaces/common';
import { PgSpaceGuardians } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class SpaceGuardianConverter implements Converter<SpaceGuardian, PgSpaceGuardians> {
  toPg = (spaceGuardian: SpaceGuardian): PgSpaceGuardians => ({
    uid: spaceGuardian.uid,
    project: spaceGuardian.project,
    createdOn: spaceGuardian.createdOn?.toDate(),
    parentId: spaceGuardian.parentId,
  });

  fromPg = (pg: PgSpaceGuardians): SpaceGuardian =>
    removeNulls({
      project: pg.project,
      parentId: pg.parentId,
      parentCol: COL.PROPOSAL,
      uid: pg.uid,
      createdOn: pgDateToTimestamp(pg.createdOn)!,
    });
}
