import { COL, MediaStatus } from '@soonaverse/interfaces';
import { clearErroredMediaStatus } from '../../../scripts/dbUpgrades/0.18/mediaStatus.roll';
import admin from '../../../src/admin.config';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

describe('Nft sale access roll', () => {
  it('Should roll nft sale access', async () => {
    const collections = [COL.NFT, COL.TOKEN, COL.COLLECTION, COL.AWARD, COL.SPACE];
    const uids = Array.from(Array(collections.length)).map(() => getRandomEthAddress());

    for (let i = 0; i < collections.length; ++i) {
      const docRef = admin.firestore().doc(`${collections[i]}/${uids[i]}`);
      await docRef.create({ name: 'asd', mediaStatus: MediaStatus.ERROR });
    }

    for (const collection of collections) {
      await clearErroredMediaStatus(collection, admin.app());
    }

    for (let i = 0; i < collections.length; ++i) {
      const docRef = admin.firestore().doc(`${collections[i]}/${uids[i]}`);
      const data = (await docRef.get()).data()!;
      expect(data.mediaStatus).toBe(MediaStatus.PENDING_UPLOAD);
      expect(data.name).toBe('asd');
    }
  });
});
