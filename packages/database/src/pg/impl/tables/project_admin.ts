import { COL, ProjectAdmin } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgProjectAdmins } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class ProjectAdminConverter implements Converter<ProjectAdmin, PgProjectAdmins> {
  toPg = (projectAdmin: ProjectAdmin): PgProjectAdmins => ({
    uid: projectAdmin.uid,
    project: projectAdmin.project,
    createdOn: projectAdmin.createdOn?.toDate(),
    parentId: projectAdmin.parentId,
  });

  fromPg = (pg: PgProjectAdmins): ProjectAdmin =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      parentId: pg.parentId,
      parentCol: COL.PROJECT,
      createdOn: pgDateToTimestamp(pg.createdOn)!,
    });
}
