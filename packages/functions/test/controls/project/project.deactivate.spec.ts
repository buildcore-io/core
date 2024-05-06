import { database } from '@buildcore/database';
import {
  COL,
  Project,
  ProjectBilling,
  ProjectCreateResponse,
  SUB_COL,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import { mockWalletReturnValue, testEnv } from '../../set-up';
import { expectThrow } from '../common';

describe('Project create', () => {
  let guardian: string;
  let project: Project;
  let token: string;

  beforeEach(async () => {
    guardian = await testEnv.createMember();
    const dummyProject = {
      name: 'My project',
      contactEmail: 'myemail@gmail.com',
      config: { billing: ProjectBilling.VOLUME_BASED },
    };
    mockWalletReturnValue(guardian, dummyProject);
    const { project: newProject } = await testEnv.wrap<ProjectCreateResponse>(
      WEN_FUNC.createProject,
    );
    project = newProject;
    const apiKey = await database().collection(COL.PROJECT, newProject.uid, SUB_COL._API_KEY).get();
    token = apiKey[0].token;
  });

  it('Should deactivate project', async () => {
    mockWalletReturnValue(guardian, {}, undefined, token);
    await testEnv.wrap(WEN_FUNC.deactivateProject);
    const projectDocRef = database().doc(COL.PROJECT, project.uid);
    const projectData = await projectDocRef.get();
    expect(projectData?.deactivated).toBe(true);
  });

  it('Should throw, not guardian of the project', async () => {
    const random = await testEnv.createMember();
    mockWalletReturnValue(random, {}, undefined, token);
    await expectThrow(
      testEnv.wrap(WEN_FUNC.deactivateProject),
      WenError.you_are_not_admin_of_project.key,
    );
  });
});
