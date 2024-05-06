import { database, storage } from '@buildcore/database';
import { COL, Stamp } from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { getBuildcoreFromUri } from '../services/joi/common';
import { getBucket } from '../utils/config.utils';

export const updateExpiredStamp = async () => {
  let stamps: Stamp[] = [];
  do {
    stamps = await query.get();
    const batch = database().batch();
    for (const s of stamps) {
      const docRef = database().doc(COL.STAMP, s.uid);
      batch.update(docRef, { expired: true });
    }
    await batch.commit();

    const promises = stamps.map(async (s) => {
      if (!s.funded) {
        return;
      }
      const folder = getBuildcoreFromUri(s.build5Url);
      const bucket = storage().bucket(getBucket());
      await bucket.deleteDirectory(folder);
    });
    await Promise.all(promises);
  } while (stamps.length);
};

const query = database()
  .collection(COL.STAMP)
  .where('expiresAt', '<=', dayjs().toDate())
  .where('expired', '==', false)
  .limit(500);
