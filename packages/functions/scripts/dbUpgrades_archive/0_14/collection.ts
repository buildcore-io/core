import { COL, CollectionStatus, NftStatus } from '@soonaverse/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import serviceAccount from '../../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();

const BATCH_LIMIT = 1000;

export const setStatusOnAllDocs = async (collection: COL, status: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastDoc: any | undefined = undefined;
  do {
    let query = db.collection(collection).limit(BATCH_LIMIT);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    const promises = snap.docs.map((doc) => {
      if (!doc.data().status) {
        console.log('Updating ' + collection + ' id: ' + doc.data().uid + '...');
        return doc.ref.update({ status });
      }
      return;
    });
    await Promise.all(promises);
    lastDoc = last(snap.docs);
  } while (lastDoc !== undefined);
};

export const run = async () => {
  await setStatusOnAllDocs(COL.COLLECTION, CollectionStatus.PRE_MINTED);
  await setStatusOnAllDocs(COL.NFT, NftStatus.PRE_MINTED);
};

run();
