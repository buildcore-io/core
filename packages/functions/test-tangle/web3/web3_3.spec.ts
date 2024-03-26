import { build5Db } from '@build-5/database';
import { COL, MediaStatus, Space, WEN_FUNC } from '@build-5/interfaces';
import { uploadMediaToWeb3 } from '../../src/cron/media.cron';
import { wait } from '../../test/controls/common';
import { MEDIA, mockWalletReturnValue, testEnv } from '../../test/set-up';

describe('Web3 cron test', () => {
  beforeEach(async () => {
    await cleanupPendingUploads();
  });

  it('Should upload space media after edit vote', async () => {
    const guardian = await testEnv.createMember();
    let space = await testEnv.createSpace(guardian);

    const spaceDocRef = build5Db().doc(COL.SPACE, space.uid);
    await spaceDocRef.update({ bannerUrl: '' });

    mockWalletReturnValue(guardian, { uid: space?.uid, bannerUrl: MEDIA });
    await testEnv.wrap(WEN_FUNC.updateSpace);

    await wait(async () => {
      space = <Space>await spaceDocRef.get();
      return space.bannerUrl === MEDIA;
    });

    await uploadMediaToWeb3();

    await wait(async () => {
      space = <Space>await spaceDocRef.get();
      return space.mediaStatus === MediaStatus.UPLOADED;
    });
  });

  it('Should fail first then retry', async () => {
    const guardian = await testEnv.createMember();
    let space = await testEnv.createSpace(guardian);

    const spaceDocRef = build5Db().doc(COL.SPACE, space.uid);
    await spaceDocRef.update({ bannerUrl: 'wrong-banner-url' });

    await uploadMediaToWeb3();

    space = <Space>await spaceDocRef.get();
    expect((space as any).mediaUploadErrorCount).toBe(1);

    await spaceDocRef.update({ bannerUrl: MEDIA });
    await uploadMediaToWeb3();
    await wait(async () => {
      space = <Space>await spaceDocRef.get();
      return space.mediaStatus === MediaStatus.UPLOADED;
    });
  });

  it('Should fail 5 times, then set to error', async () => {
    const guardian = await testEnv.createMember();
    let space = await testEnv.createSpace(guardian);

    const spaceDocRef = build5Db().doc(COL.SPACE, space.uid);
    await spaceDocRef.update({ bannerUrl: 'wrong-banner-url' });

    for (let i = 0; i < 6; ++i) {
      await uploadMediaToWeb3();
      space = <Space>await spaceDocRef.get();
      expect((space as any).mediaUploadErrorCount).toBe(i + 1);
      expect(space.mediaStatus).toBe(i === 5 ? MediaStatus.ERROR : MediaStatus.PENDING_UPLOAD);
    }
  });

  afterEach(async () => {
    await cleanupPendingUploads();
  });
});

const cleanupPendingUploads = async () => {
  for (const col of [COL.TOKEN, COL.NFT, COL.COLLECTION]) {
    const snap = await pendingUploadsQuery(col).get();
    const promises = snap.map((d) => {
      const docRef = build5Db().doc(col as COL.TOKEN, d.uid);
      return docRef.update({ mediaStatus: undefined });
    });
    await Promise.all(promises);
  }
};

const pendingUploadsQuery = (col: COL) =>
  build5Db()
    .collection(col as COL.TOKEN)
    .where('mediaStatus', '==', MediaStatus.PENDING_UPLOAD);
