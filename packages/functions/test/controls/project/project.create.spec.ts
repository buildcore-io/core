import { build5Db } from '@build-5/database';
import {
  COL,
  Network,
  Project,
  ProjectAdmin,
  ProjectBilling,
  SOON_PROJECT_ID,
  SUB_COL,
  Token,
  TokenStatus,
  Transaction,
  WenError,
} from '@build-5/interfaces';
import { CoinType, utf8ToHex } from '@iota/sdk';
import axios from 'axios';
import { AVAILABLE_NETWORKS } from '../../../src/controls/common';
import { createProject } from '../../../src/runtime/firebase/project/index';
import { getSecretManager } from '../../../src/utils/secret.manager.utils';
import * as wallet from '../../../src/utils/wallet.utils';
import { getRandomNonce } from '../../../src/utils/wallet.utils';
import { getWallet, testEnv } from '../../set-up';
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
      project: SOON_PROJECT_ID,
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

    const projectAdminDocRef = projectDocRef.collection(SUB_COL.ADMINS).doc(guardian);
    const projectAdmin = await projectAdminDocRef.get<ProjectAdmin>();
    expect(projectAdmin?.uid).toBe(guardian);
    expect(projectAdmin?.parentCol).toBe(COL.PROJECT);
    expect(projectAdmin?.parentId).toBe(project?.uid);

    const networks = Object.values(project!.otr!).map((o) => o.network);
    expect(networks.sort()).toEqual(AVAILABLE_NETWORKS.sort());

    for (const [uid, otr] of Object.entries(project?.otr!)) {
      const docRef = build5Db().doc(`${COL.TRANSACTION}/${uid}`);
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
        nativeTokenSymbol: token.symbol,
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
    expect(project?.config?.nativeTokenSymbol).toBe(dummyProject.config.nativeTokenSymbol);
    expect(project?.config?.nativeTokenUid).toBe(token.uid);

    const projectAdminDocRef = projectDocRef.collection(SUB_COL.ADMINS).doc(guardian);
    const adminGuardian = await projectAdminDocRef.get<ProjectAdmin>();
    expect(adminGuardian?.uid).toBe(guardian);
    expect(adminGuardian?.parentCol).toBe(COL.PROJECT);
    expect(adminGuardian?.parentId).toBe(project?.uid);

    const networks = Object.values(project!.otr!).map((o) => o.network);
    expect(networks.sort()).toEqual(AVAILABLE_NETWORKS.sort());

    for (const [uid, otr] of Object.entries(project?.otr!)) {
      const docRef = build5Db().doc(`${COL.TRANSACTION}/${uid}`);
      const otrOrder = <Transaction>await docRef.get();
      expect(otrOrder.uid).toBe(uid);
      expect(otrOrder.network).toBe(otr.network);
      expect(otrOrder.payload.targetAddress).toBe(otr.targetAddress);
      expect(otrOrder.project).toBe(project?.uid);
      await docRef.delete();
    }
  });

  it('Should create project without project id', async () => {
    const wallet = await getWallet(Network.RMS);
    const address = await wallet.getNewIotaAddressDetails();

    const nonce = getRandomNonce();
    const userDocRef = build5Db().doc(`${COL.MEMBER}/${address.bech32}`);
    await userDocRef.create({ uid: address.bech32, nonce });

    const secretManager = getSecretManager(address.mnemonic);
    const signature = await secretManager.signEd25519(utf8ToHex(nonce), {
      coinType: CoinType.IOTA,
    });
    const request = {
      data: {
        address: address.bech32,
        projectApiKey: '',
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        body: {
          name: 'My project',
          contactEmail: 'myemail@gmail.com',
          config: { billing: ProjectBilling.VOLUME_BASED },
        },
      },
    };
    const url = 'http://127.0.0.1:5001/soonaverse-dev/us-central1/https-createproject';
    const response = await axios.post(url, request);
    expect(response.data.data.token).toBeDefined();
  });
});
