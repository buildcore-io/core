import { COL, MediaStatus, Space } from '@soonaverse/interfaces';
import { uploadMediaToWeb3 } from '../../src/cron/media.cron';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { updateSpace } from '../../src/runtime/firebase/space';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, mockWalletReturnValue, wait } from '../../test/controls/common';
import { MEDIA, testEnv } from '../../test/set-up';

let walletSpy: any;

describe('Web3 cron test', () => {
  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    await cleanupPendingUploads();
  });

  it('Should upload space media after edit vote', async () => {
    const guardian = await createMember(walletSpy);
    let space = await createSpace(walletSpy, guardian);

    const spaceDocRef = soonDb().doc(`${COL.SPACE}/${space.uid}`);
    await spaceDocRef.update({ bannerUrl: '' });

    mockWalletReturnValue(walletSpy, guardian, { uid: space?.uid, bannerUrl: MEDIA });
    await testEnv.wrap(updateSpace)({});

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
    const guardian = await createMember(walletSpy);
    let space = await createSpace(walletSpy, guardian);

    const spaceDocRef = soonDb().doc(`${COL.SPACE}/${space.uid}`);
    await spaceDocRef.update({ bannerUrl: 'asd' });

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
    const guardian = await createMember(walletSpy);
    let space = await createSpace(walletSpy, guardian);

    const spaceDocRef = soonDb().doc(`${COL.SPACE}/${space.uid}`);
    await spaceDocRef.update({ bannerUrl: 'asd' });

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
    const snap = await pendingUploadsQuery(col).get<Record<string, unknown>>();
    const promises = snap.map((d) => {
      const docRef = soonDb().doc(`${col}/${d.uid}`);
      return docRef.update({ mediaStatus: soonDb().deleteField() });
    });
    await Promise.all(promises);
  }
};

const pendingUploadsQuery = (col: COL) =>
  soonDb().collection(col).where('mediaStatus', '==', MediaStatus.PENDING_UPLOAD);
