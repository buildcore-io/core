import { database } from '@buildcore/database';
import {
  COL,
  ProjectBilling,
  ProjectCreateResponse,
  SOON_PROJECT_ID,
  SUB_COL,
  Token,
  TokenStatus,
  Transaction,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import { AVAILABLE_NETWORKS } from '../../../src/controls/common';
import * as wallet from '../../../src/utils/wallet.utils';
import { mockWalletReturnValue, testEnv } from '../../set-up';
import { expectThrow, getRandomSymbol } from '../common';

describe('Project create', () => {
  let guardian: string;
  let token: Token;
  beforeEach(async () => {
    guardian = await testEnv.createMember();
    const tokenId = wallet.getRandomEthAddress();
    const tokenUpsert = {
      project: SOON_PROJECT_ID,
      uid: tokenId,
      symbol: getRandomSymbol(),
      name: 'MyToken',
      space: 'myspace',
      status: TokenStatus.AVAILABLE,
      approved: true,
    };
    await database().doc(COL.TOKEN, tokenId).upsert(tokenUpsert);
    token = (await database().doc(COL.TOKEN, tokenId).get())!;
  });

  it('Should create volume based project', async () => {
    const dummyProject = {
      name: 'My project',
      contactEmail: 'myemail@gmail.com',
      config: { billing: ProjectBilling.VOLUME_BASED },
    };

    mockWalletReturnValue(guardian, dummyProject);
    const { project: newProject } = await testEnv.wrap<ProjectCreateResponse>(
      WEN_FUNC.createProject,
    );

    const projectDocRef = database().doc(COL.PROJECT, newProject.uid);
    const project = await projectDocRef.get();
    expect(project?.name).toBe(dummyProject.name);
    expect(project?.contactEmail).toBe(dummyProject.contactEmail);
    expect(project?.deactivated).toBe(false);
    expect(project?.config?.billing).toBe(ProjectBilling.VOLUME_BASED);

    const projectAdminDocRef = database().doc(
      COL.PROJECT,
      newProject.uid,
      SUB_COL.ADMINS,
      guardian,
    );
    const projectAdmin = await projectAdminDocRef.get();
    expect(projectAdmin?.uid).toBe(guardian);
    expect(projectAdmin?.parentCol).toBe(COL.PROJECT);
    expect(projectAdmin?.parentId).toBe(project?.uid);
    const networks = Object.values(project!.otr!).map((o) => o.network);
    expect(networks.sort()).toEqual(AVAILABLE_NETWORKS.sort());
    for (const [uid, otr] of Object.entries(project?.otr!)) {
      const docRef = database().doc(COL.TRANSACTION, uid);
      const otrOrder = <Transaction>await docRef.get();
      expect(otrOrder.uid).toBe(uid);
      expect(otrOrder.network).toBe(otr.network);
      expect(otrOrder.payload.targetAddress).toBe(otr.targetAddress);
      await docRef.delete();
    }
  });

  it('Should throw, volume based project with token based data', async () => {
    const dummyProject = {
      name: 'My project',
      contactEmail: 'myemail@gmail.com',
      config: { billing: ProjectBilling.VOLUME_BASED, tiers: [1, 2, 3, 4] },
    };

    mockWalletReturnValue(guardian, dummyProject);
    await expectThrow(
      testEnv.wrap<ProjectCreateResponse>(WEN_FUNC.createProject),
      WenError.invalid_params.key,
    );
  });

  it('Should create token based project', async () => {
    const dummyProject = {
      name: 'My project',
      contactEmail: 'myemail@gmail.com',
      config: {
        billing: ProjectBilling.TOKEN_BASED,
        tiers: [1, 2, 3, 4, 5],
        tokenTradingFeeDiscountPercentage: [0, 0, 0, 0, 0],
        nativeTokenSymbol: token.symbol,
      },
    };
    mockWalletReturnValue(guardian, dummyProject);
    const { project: newProject } = await testEnv.wrap<ProjectCreateResponse>(
      WEN_FUNC.createProject,
    );
    const projectDocRef = database().doc(COL.PROJECT, newProject.uid);
    const project = await projectDocRef.get();
    expect(project?.name).toBe(dummyProject.name);
    expect(project?.contactEmail).toBe(dummyProject.contactEmail);
    expect(project?.deactivated).toBe(false);
    expect(project?.config?.billing).toBe(ProjectBilling.TOKEN_BASED);
    expect(project?.config?.tiers).toEqual(dummyProject.config.tiers);
    expect(project?.config?.tokenTradingFeeDiscountPercentage).toEqual(
      dummyProject.config.tokenTradingFeeDiscountPercentage,
    );
    expect(project?.config?.nativeTokenSymbol).toBe(dummyProject.config.nativeTokenSymbol);
    expect(project?.config?.nativeTokenUid).toBe(token.uid);
    const projectAdminDocRef = database().doc(
      COL.PROJECT,
      newProject.uid,
      SUB_COL.ADMINS,
      guardian,
    );
    const adminGuardian = await projectAdminDocRef.get();
    expect(adminGuardian?.uid).toBe(guardian);
    expect(adminGuardian?.parentCol).toBe(COL.PROJECT);
    expect(adminGuardian?.parentId).toBe(project?.uid);
    const networks = Object.values(project!.otr!).map((o) => o.network);
    expect(networks.sort()).toEqual(AVAILABLE_NETWORKS.sort());
    for (const [uid, otr] of Object.entries(project?.otr!)) {
      const docRef = database().doc(COL.TRANSACTION, uid);
      const otrOrder = <Transaction>await docRef.get();
      expect(otrOrder.uid).toBe(uid);
      expect(otrOrder.network).toBe(otr.network);
      expect(otrOrder.payload.targetAddress).toBe(otr.targetAddress);
      expect(otrOrder.project).toBe(project?.uid);
      await docRef.delete();
    }
  });

  it('Should create project without project id', async () => {
    const dummyProject = {
      name: 'My project',
      contactEmail: 'myemail@gmail.com',
      config: {
        billing: ProjectBilling.TOKEN_BASED,
        tiers: [1, 2, 3, 4, 5],
        tokenTradingFeeDiscountPercentage: [0, 0, 0, 0, 0],
        nativeTokenSymbol: token.symbol,
      },
    };
    mockWalletReturnValue(guardian, dummyProject, '');
    const { project: newProject } = await testEnv.wrap<ProjectCreateResponse>(
      WEN_FUNC.createProject,
    );
    const projectDocRef = database().doc(COL.PROJECT, newProject.uid);
    const project = await projectDocRef.get();
    expect(project?.name).toBe(dummyProject.name);
    expect(project?.contactEmail).toBe(dummyProject.contactEmail);
    expect(project?.deactivated).toBe(false);
    expect(project?.config?.billing).toBe(ProjectBilling.TOKEN_BASED);
  });
});
