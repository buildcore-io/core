import { COL, SpaceMember } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgSpaceMembers } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class SpaceMemberConverter implements Converter<SpaceMember, PgSpaceMembers> {
  toPg = (spaceMember: SpaceMember): PgSpaceMembers => ({
    uid: spaceMember.uid,
    project: spaceMember.project,
    createdOn: spaceMember.createdOn?.toDate(),
    parentId: spaceMember.parentId,
  });

  fromPg = (pg: PgSpaceMembers): SpaceMember =>
    removeNulls({
      project: pg.project,
      parentId: pg.parentId,
      parentCol: COL.SPACE,
      uid: pg.uid,
      createdOn: pgDateToTimestamp(pg.createdOn)!,
    });
}
