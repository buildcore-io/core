import { COL, ProjectApiKey } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgProjectApiKey } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class ProjectApiKeyConverter implements Converter<ProjectApiKey, PgProjectApiKey> {
  toPg = (pk: ProjectApiKey): PgProjectApiKey => ({
    uid: pk.uid,
    project: pk.project,
    createdOn: pk.createdOn?.toDate(),
    parentId: pk.parentId,
    token: pk.token,
  });

  fromPg = (pg: PgProjectApiKey): ProjectApiKey =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      parentId: pg.parentId,
      parentCol: COL.PROJECT,
      createdOn: pgDateToTimestamp(pg.createdOn)!,
      token: pg.token!,
    });
}
