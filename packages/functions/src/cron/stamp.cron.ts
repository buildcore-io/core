import { build5Db, build5Storage } from '@build-5/database';
import { COL, Stamp } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { getBuild5FromUri } from '../services/joi/common';
import { getBucket } from '../utils/config.utils';

export const updateExpiredStamp = async () => {
  let stamps: Stamp[] = [];
  do {
    stamps = await query.get<Stamp>();
    const batch = build5Db().batch();
    stamps.forEach((s) => {
      const docRef = build5Db().doc(`${COL.STAMP}/${s.uid}`);
      batch.update(docRef, { expired: true });
    });
    await batch.commit();

    const promises = stamps.map(async (s) => {
      if (!s.funded) {
        return;
      }
      const folder = getBuild5FromUri(s.build5Url);
      const bucket = build5Storage().bucket(getBucket());
      await bucket.deleteDirectory(folder);
    });
    await Promise.all(promises);
  } while (stamps.length);
};

const query = build5Db()
  .collection(COL.STAMP)
  .where('expiresAt', '<=', dayjs().toDate())
  .where('expired', '==', false)
  .limit(500);
