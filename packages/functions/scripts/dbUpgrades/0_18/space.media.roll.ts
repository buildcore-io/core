/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, MediaStatus } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { isEmpty, last } from 'lodash';

export const setMediaStatusOnSpaces = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;
  do {
    let query = db.collection(COL.SPACE).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    for (const doc of snap.docs) {
      const space = doc.data();
      if (isEmpty(space.bannerUrl) || !isEmpty(space.mediaStatus)) {
        continue;
      }
      await doc.ref.update({ mediaStatus: MediaStatus.PREPARE_IPFS });
    }
  } while (lastDoc);
};

export const roll = setMediaStatusOnSpaces;
