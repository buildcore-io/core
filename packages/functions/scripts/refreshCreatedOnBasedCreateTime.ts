import { COL } from '@soonaverse/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();

export const fixCreatedOn = async (col: COL) => {
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
      if (doc.createTime) {
        console.log('Updating: ' + doc.data().uid);
        return doc.ref.update({
          createdOn: doc.createTime,
        });
      } else {
        return undefined;
      }
    });

    await Promise.all(promises);
    lastDoc = last(snap.docs);
  } while (lastDoc !== undefined);
};

fixCreatedOn(COL.MEMBER);
// removeKeywords(COL.AWARD);
// removeKeywords(COL.PROPOSAL);
// removeKeywords(COL.SPACE);
// removeKeywords(COL.NFT);
// removeKeywords(COL.COLLECTION);
// removeKeywords(COL.TOKEN);
