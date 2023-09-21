import { build5Db } from '@build-5/database';
import {
  COL,
  Project,
  ProjectBilling,
  ProjectGuardian,
  SUB_COL,
  Token,
  TokenStatus,
  WenError,
} from '@build-5/interfaces';
import { createProject } from '../../../src/runtime/firebase/project/index';
import * as wallet from '../../../src/utils/wallet.utils';
import { testEnv } from '../../set-up';
import { createMember, expectThrow, getRandomSymbol, mockWalletReturnValue } from '../common';

describe('Project create', () => {
  let walletSpy: any;
  let guardian: string;
  let token: Token;

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
  });

  beforeEach(async () => {
    guardian = await createMember(walletSpy);
    const tokenId = wallet.getRandomEthAddress();
    token = <Token>{
      uid: tokenId,
      symbol: getRandomSymbol(),
      name: 'MyToken',
      space: 'myspace',
      status: TokenStatus.AVAILABLE,
      approved: true,
    };
    await build5Db().doc(`${COL.TOKEN}/${tokenId}`).set(token);
  });

  it('Should create volume based project', async () => {
    const dummyProject = {
      name: 'My project',
      contactEmail: 'myemail@gmail.com',
      config: { billing: ProjectBilling.VOLUME_BASED },
    };
    mockWalletReturnValue(walletSpy, guardian, dummyProject);
    const { project: newProject } = await testEnv.wrap(createProject)({});

    const projectDocRef = build5Db().doc(`${COL.PROJECT}/${newProject.uid}`);
    const project = await projectDocRef.get<Project>();
    expect(project?.name).toBe(dummyProject.name);
    expect(project?.contactEmail).toBe(dummyProject.contactEmail);
    expect(project?.deactivated).toBe(false);
    expect(project?.config?.billing).toBe(ProjectBilling.VOLUME_BASED);

    const projectGuardianDocRef = projectDocRef.collection(SUB_COL.GUARDIANS).doc(guardian);
    const projectGuardian = await projectGuardianDocRef.get<ProjectGuardian>();
    expect(projectGuardian?.uid).toBe(guardian);
    expect(projectGuardian?.parentCol).toBe(COL.PROJECT);
    expect(projectGuardian?.parentId).toBe(project?.uid);
  });

  it('Should throw, volume based project with token based data', async () => {
    const dummyProject = {
      name: 'My project',
      contactEmail: 'myemail@gmail.com',
      config: { billing: ProjectBilling.VOLUME_BASED, tiers: [1, 2, 3, 4] },
    };
    mockWalletReturnValue(walletSpy, guardian, dummyProject);
    await expectThrow(testEnv.wrap(createProject)({}), WenError.invalid_params.key);
  });

  it('Should create token based project', async () => {
    const dummyProject = {
      name: 'My project',
      contactEmail: 'myemail@gmail.com',
      config: {
        billing: ProjectBilling.TOKEN_BASE,
        tiers: [1, 2, 3, 4, 5],
        tokenTradingFeeDiscountPercentage: [0, 0, 0, 0, 0],
        baseTokenSymbol: token.symbol,
        baseTokenUid: token.uid,
      },
    };
    mockWalletReturnValue(walletSpy, guardian, dummyProject);
    const { project: newProject } = await testEnv.wrap(createProject)({});

    const projectDocRef = build5Db().doc(`${COL.PROJECT}/${newProject.uid}`);
    const project = await projectDocRef.get<Project>();
    expect(project?.name).toBe(dummyProject.name);
    expect(project?.contactEmail).toBe(dummyProject.contactEmail);
    expect(project?.deactivated).toBe(false);
    expect(project?.config?.billing).toBe(ProjectBilling.TOKEN_BASE);
    expect(project?.config?.tiers).toEqual(dummyProject.config.tiers);
    expect(project?.config?.tokenTradingFeeDiscountPercentage).toEqual(
      dummyProject.config.tokenTradingFeeDiscountPercentage,
    );
    expect(project?.config?.baseTokenSymbol).toBe(dummyProject.config.baseTokenSymbol);
    expect(project?.config?.baseTokenUid).toBe(dummyProject.config.baseTokenUid);

    const projectGuardianDocRef = projectDocRef.collection(SUB_COL.GUARDIANS).doc(guardian);
    const projectGuardian = await projectGuardianDocRef.get<ProjectGuardian>();
    expect(projectGuardian?.uid).toBe(guardian);
    expect(projectGuardian?.parentCol).toBe(COL.PROJECT);
    expect(projectGuardian?.parentId).toBe(project?.uid);
  });
});
