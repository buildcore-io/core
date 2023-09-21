import { build5Db } from '@build-5/database';
import { COL, Project } from '@build-5/interfaces';
import { Context } from '../../runtime/firebase/common';
import { assertIsProjectGuardian } from '../../utils/common.utils';

export const deactivateProjectControl = async ({ project, owner }: Context): Promise<Project> => {
  await assertIsProjectGuardian(project, owner);

  const projectDocRef = build5Db().doc(`${COL.PROJECT}/${project}`);
  await projectDocRef.update({ deactivated: true });
  return (await projectDocRef.get<Project>())!;
};
