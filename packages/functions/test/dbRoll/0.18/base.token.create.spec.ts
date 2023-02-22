import {
  COL,
  Network,
  Space,
  SpaceGuardian,
  SUB_COL,
  Token,
  TokenStatus,
} from '@soonaverse/interfaces';
import admin from '../../../src/admin.config';
import {
  createbaseTokens,
  GUARDIAN_UID,
  RMS_SPACE_UID,
  RMS_TOKEN_UID,
  SMR_SPACE_UID,
  SMR_TOKEN_UID,
} from '../../../src/firebase/dbRoll/base.token.create';
import * as config from '../../../src/utils/config.utils';

describe('Base token create', () => {
  let isProdSpy: jest.SpyInstance<boolean, []>;

  beforeEach(() => {
    isProdSpy = jest.spyOn(config, 'isProdEnv');
  });

  it('Should create base tokens', async () => {
    const req = {} as any;
    const res = {
      sendStatus: (code: number) => {
        expect(code).toBe(200);
      },
    } as any;
    await createbaseTokens(req, res);

    await assertSpace(SMR_SPACE_UID, Network.SMR);
    await assertSpace(RMS_SPACE_UID, Network.RMS);

    await assertToken(SMR_TOKEN_UID, SMR_SPACE_UID, Network.SMR);
    await assertToken(RMS_TOKEN_UID, RMS_SPACE_UID, Network.RMS);

    try {
      await createbaseTokens(req, res);
      fail();
    } catch (error) {}
  });

  it('Should create only smr in prod', async () => {
    const req = {} as any;
    const res = {
      sendStatus: (code: number) => {
        expect(code).toBe(200);
      },
    } as any;
    isProdSpy.mockReturnValue(true);
    await createbaseTokens(req, res);
    isProdSpy.mockRestore();

    await assertSpace(SMR_SPACE_UID, Network.SMR);
    await assertToken(SMR_TOKEN_UID, SMR_SPACE_UID, Network.SMR);

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${RMS_SPACE_UID}`);
    const spaceDoc = await spaceDocRef.get();
    expect(spaceDoc.exists).toBe(false);

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${RMS_TOKEN_UID}`);
    const tokenDoc = await tokenDocRef.get();
    expect(tokenDoc.exists).toBe(false);
  });

  afterEach(async () => {
    admin.firestore().doc(`${COL.SPACE}/${SMR_SPACE_UID}`).delete();
    admin
      .firestore()
      .doc(`${COL.SPACE}/${SMR_SPACE_UID}`)
      .collection(SUB_COL.GUARDIANS)
      .doc(GUARDIAN_UID)
      .delete();
    admin.firestore().doc(`${COL.SPACE}/${RMS_SPACE_UID}`).delete();
    admin
      .firestore()
      .doc(`${COL.SPACE}/${RMS_SPACE_UID}`)
      .collection(SUB_COL.GUARDIANS)
      .doc(GUARDIAN_UID)
      .delete();

    admin.firestore().doc(`${COL.TOKEN}/${SMR_TOKEN_UID}`).delete();
    admin.firestore().doc(`${COL.TOKEN}/${RMS_TOKEN_UID}`).delete();
  });

  const assertSpace = async (spaceId: string, network: Network) => {
    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${spaceId}`);
    const space = <Space>(await spaceDocRef.get()).data();
    expect(space.vaultAddress).toBeDefined();
    expect(space.createdBy).toBe(GUARDIAN_UID);
    expect(space.name).toBe(network.toUpperCase());
    expect(space.open).toBeNull();
    expect(space.totalMembers).toBe(1);
    expect(space.totalGuardians).toBe(1);

    const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(GUARDIAN_UID);
    const guardian = <SpaceGuardian>(await guardianDocRef.get()).data();
    expect(guardian.parentCol).toBe('space');
    expect(guardian.parentId).toBe(spaceId);
    expect(guardian.uid).toBe(GUARDIAN_UID);
  };

  const assertToken = async (tokenId: string, spaceId: string, network: Network) => {
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${tokenId}`);
    const token = <Token>(await tokenDocRef.get()).data();

    expect(token.createdBy).toBe(GUARDIAN_UID);
    expect(token.shortDescription).toBe(network.toUpperCase());
    expect(token.mintingData).toEqual({ network, networkFormat: network });
    expect(token.status).toBe(TokenStatus.BASE);
    expect(token.space).toBe(spaceId);
    expect(token.name).toBe(network.toUpperCase());
    expect(token.public).toBe(false);
    expect(token.approved).toBe(true);
    expect(token.rejected).toBe(false);
    expect(token.shortDescriptionTitle).toBe(network.toUpperCase());
    expect(token.access).toBe(0);
    expect(token.symbol).toBe(network.toUpperCase());
    expect(token.title).toBe(network.toUpperCase());
  };
});
