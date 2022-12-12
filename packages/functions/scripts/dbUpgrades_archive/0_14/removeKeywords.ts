import { COL } from '@soonaverse/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import serviceAccount from '../../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

export const removeKeywords = async (col: COL) => {
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
      if (!data.keywords) {
        return undefined;
      }
      return doc.ref.update({
        keywords: FieldValue.delete(),
      });
    });

    await Promise.all(promises);
    lastDoc = last(snap.docs);
  } while (lastDoc !== undefined);
};

removeKeywords(COL.MEMBER);
removeKeywords(COL.AWARD);
removeKeywords(COL.PROPOSAL);
removeKeywords(COL.SPACE);
removeKeywords(COL.NFT);
removeKeywords(COL.COLLECTION);
removeKeywords(COL.TOKEN);
