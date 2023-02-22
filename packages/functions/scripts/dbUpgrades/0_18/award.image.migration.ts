/* eslint-disable @typescript-eslint/no-explicit-any */
import { AwardDeprecated, AwardTypeDeprecated, COL, MediaStatus } from '@soonaverse/interfaces';
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
    let query = db
      .collection(COL.AWARD)
      .where('type', 'in', [
        AwardTypeDeprecated.CUSTOM,
        AwardTypeDeprecated.PARTICIPATE_AND_APPROVE,
      ])
      .limit(BATCH_LIMIT);
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
        awardDep.badge.image.original,
        getStorage(app),
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

export const roll = awardImageMigration;
