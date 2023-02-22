/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, MediaStatus, Space } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { isEmpty, last } from 'lodash';

export const setMediaStatusOnSpaces = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;
  do {
    let query = db.collection(COL.SPACE).limit(1000);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const promises = snap.docs.map(setSpaceIpfs);
    await Promise.all(promises);
  } while (lastDoc);
};

const setSpaceIpfs = async (
  doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>,
) => {
  const space = doc.data();
  if (isEmpty(space.bannerUrl) || !isEmpty(space.mediaStatus)) {
    return;
  }
  await doc.ref.update({ mediaStatus: MediaStatus.PREPARE_IPFS });

  await wait(space.uid, async () => {
    const space = <Space>(await doc.ref.get()).data();
    return !isEmpty(space.ipfsMedia);
  });
};

export const wait = async (spaceId: string, func: () => Promise<boolean>) => {
  for (let attempt = 0; attempt < 300; ++attempt) {
    if (await func()) {
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Timeout: ' + spaceId);
};

export const roll = setMediaStatusOnSpaces;
