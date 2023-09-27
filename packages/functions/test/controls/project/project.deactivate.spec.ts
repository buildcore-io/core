import { build5Db } from '@build-5/database';
import { COL, Project, SOON_PROJECT_ID, WenError } from '@build-5/interfaces';
import { deactivateProject } from '../../../src/runtime/firebase/project/index';
import * as wallet from '../../../src/utils/wallet.utils';
import { SOON_PROJ_GUARDIAN, testEnv } from '../../set-up';
import { createMember, expectThrow, mockWalletReturnValue } from '../common';

describe('Project create', () => {
  let walletSpy: any;
  let guardian: string;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardian = await createMember(walletSpy);
  });

  it('Should deactivate project', async () => {
    mockWalletReturnValue(walletSpy, SOON_PROJ_GUARDIAN, {});
    await testEnv.wrap(deactivateProject)({});

    const projectDocRef = build5Db().doc(`${COL.PROJECT}/${SOON_PROJECT_ID}`);
    const projectData = await projectDocRef.get<Project>();
    expect(projectData?.deactivated).toBe(true);

    await projectDocRef.update({ deactivated: false });
  });

  it('Should throw, not guardian of the project', async () => {
    mockWalletReturnValue(walletSpy, guardian, {});
    await expectThrow(
      testEnv.wrap(deactivateProject)({}),
      WenError.you_are_not_admin_of_project.key,
    );
  });
});
