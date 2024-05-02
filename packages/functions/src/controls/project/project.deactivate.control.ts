import { database } from '@buildcore/database';
import { COL, Project } from '@buildcore/interfaces';
import { assertIsProjectAdmin } from '../../utils/common.utils';
import { Context } from '../common';

export const deactivateProjectControl = async ({ project, owner }: Context): Promise<Project> => {
  await assertIsProjectAdmin(project, owner);

  const projectDocRef = database().doc(COL.PROJECT, project);
  await projectDocRef.update({ deactivated: true });
  return (await projectDocRef.get())!;
};
