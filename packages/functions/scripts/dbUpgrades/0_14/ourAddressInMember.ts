import { COL, Network } from '@soonaverse/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import serviceAccount from '../../serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();

const BATCH_LIMIT = 1000;

export const setStatusOnAllDocs = async (collection: COL) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastDoc: any | undefined = undefined;
  do {
    let query = db.collection(collection).limit(BATCH_LIMIT);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    const promises = snap.docs.map((doc) => {
      if (doc.data()?.validatedAddress?.[Network.SMR]) {
        return db
          .collection('_mnemonic')
          .doc(doc.data()?.validatedAddress?.[Network.SMR])
          .get()
          .then(async (ss) => {
            if (ss.data()) {
              console.log(doc.data()?.name + ' - ' + doc.data()?.uid);
            }
          });
      } else {
        return undefined;
      }
    });
    await Promise.all(promises);
    lastDoc = last(snap.docs);
  } while (lastDoc !== undefined);
};

export const run = async () => {
  console.log('Members:');
  await setStatusOnAllDocs(COL.MEMBER);
  console.log('Spaces:');
  await setStatusOnAllDocs(COL.SPACE);
};

run();
