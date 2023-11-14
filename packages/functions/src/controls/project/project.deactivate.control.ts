import { build5Db } from '@build-5/database';
import { COL, Project } from '@build-5/interfaces';
import { assertIsProjectAdmin } from '../../utils/common.utils';
import { Context } from '../common';

export const deactivateProjectControl = async ({ project, owner }: Context): Promise<Project> => {
  await assertIsProjectAdmin(project, owner);

  const projectDocRef = build5Db().doc(`${COL.PROJECT}/${project}`);
  await projectDocRef.update({ deactivated: true });
  return (await projectDocRef.get<Project>())!;
};
