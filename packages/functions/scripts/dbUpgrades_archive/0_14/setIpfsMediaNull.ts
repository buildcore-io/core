import { COL } from '@soonaverse/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import serviceAccount from '../../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();

export const setIpfsMediaNull = async (col: COL) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastDoc: any | undefined = undefined;
  do {
    let query = db.collection(col).orderBy('createdOn');
    if (lastDoc) {
      query = query.startAfter(lastDoc).limit(1000);
    } else {
      query = query.limit(500);
    }
    const snap = await query.get();

    const promises = snap.docs.map((doc) => {
      const data = <any>doc.data();
      if (data.ipfsMedia) {
        return undefined;
      }
      return doc.ref.update({
        ipfsMedia: null,
      });
    });

    await Promise.all(promises);
    lastDoc = last(snap.docs);
  } while (lastDoc !== undefined);
};

setIpfsMediaNull(COL.TOKEN);
setIpfsMediaNull(COL.COLLECTION);
