import { COL, MediaStatus, Space } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { updateSpace } from '../../src/controls/space/space.update.control';
import { uploadMediaToWeb3 } from '../../src/cron/media.cron';
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

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space.uid}`);
    await spaceDocRef.update({ bannerUrl: '' });

    mockWalletReturnValue(walletSpy, guardian, { uid: space?.uid, bannerUrl: MEDIA });
    await testEnv.wrap(updateSpace)({});

    await wait(async () => {
      space = <Space>(await spaceDocRef.get()).data();
      return space.bannerUrl === MEDIA;
    });

    await uploadMediaToWeb3();

    await wait(async () => {
      space = <Space>(await spaceDocRef.get()).data();
      return space.mediaStatus === MediaStatus.UPLOADED;
    });
  });

  it('Should fail first then retry', async () => {
    const guardian = await createMember(walletSpy);
    let space = await createSpace(walletSpy, guardian);

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space.uid}`);
    await spaceDocRef.update({ bannerUrl: 'asd' });

    await uploadMediaToWeb3();

    space = <Space>(await spaceDocRef.get()).data();
    expect((space as any).mediaUploadErrorCount).toBe(1);

    await spaceDocRef.update({ bannerUrl: MEDIA });
    await uploadMediaToWeb3();
    await wait(async () => {
      space = <Space>(await spaceDocRef.get()).data();
      return space.mediaStatus === MediaStatus.UPLOADED;
    });
  });

  it('Should fail 5 times, then set to error', async () => {
    const guardian = await createMember(walletSpy);
    let space = await createSpace(walletSpy, guardian);

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space.uid}`);
    await spaceDocRef.update({ bannerUrl: 'asd' });

    for (let i = 0; i < 6; ++i) {
      await uploadMediaToWeb3();
      space = <Space>(await spaceDocRef.get()).data();
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
    const promises = snap.docs.map((d) =>
      d.ref.update({ mediaStatus: admin.firestore.FieldValue.delete() }),
    );
    await Promise.all(promises);
  }
};

const pendingUploadsQuery = (col: COL) =>
  admin.firestore().collection(col).where('mediaStatus', '==', MediaStatus.PENDING_UPLOAD);
