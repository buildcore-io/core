/* eslint-disable @typescript-eslint/no-explicit-any */
import { AwardDeprecated, Bucket, COL, MediaStatus } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { get, last } from 'lodash';
import { downloadMediaAndPackCar } from '../../../src/utils/car.utils';
import { migrateIpfsMediaToSotrage } from '../../../src/utils/ipfs.utils';

const BATCH_LIMIT = 15;

export const awardImageMigration = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any = undefined;

  do {
    let query = db.collection(COL.AWARD).limit(BATCH_LIMIT);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const promises = snap.docs.map(async (doc): Promise<number> => {
      const awardDep = doc.data() as AwardDeprecated;
      if (!awardDep.badge.image || get(awardDep.badge, 'ipfsMedia')) {
        return 0;
      }
      const image = await migrateIpfsMediaToSotrage(
        COL.AWARD,
        awardDep.createdBy!,
        awardDep.uid,
        awardDep.badge.image.original + '/' + awardDep.badge.image.fileName + '.png',
        getStorage(app).bucket(getBucket(app)),
      );
      const ipfs = await downloadMediaAndPackCar(awardDep.uid, image, {});
      await doc.ref.update({
        updatetOn: FieldValue.serverTimestamp(),
        'badge.image': image,
        'badge.ipfsMedia': ipfs.ipfsMedia,
        'badge.ipfsMetadata': ipfs.ipfsMetadata,
        'badge.ipfsRoot': ipfs.ipfsRoot,
        mediaStatus: MediaStatus.PENDING_UPLOAD,
      });
      return 1;
    });

    const results = await Promise.all(promises);
    const total = results.reduce((sum, act) => sum + act, 0);
    if (total) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } while (lastDoc);
};

const getBucket = (app: App) => {
  const projectId = (app.options.credential as any).projectId;
  if (projectId === 'soonaverse') {
    return Bucket.PROD;
  }
  if (projectId === 'soonaverse-test') {
    return Bucket.TEST;
  }
  return Bucket.DEV;
};

export const roll = awardImageMigration;
