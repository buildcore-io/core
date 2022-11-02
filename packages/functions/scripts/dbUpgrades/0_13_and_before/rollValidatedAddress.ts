import { COL, Network } from '@soonaverse/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import serviceAccount from '../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();

export const rolValidatedAddress = async (collection: COL) => {
  let lastDoc: any;
  do {
    let snap: any = db.collection(collection).orderBy('createdOn');
    if (lastDoc) {
      snap = snap.startAfter(lastDoc);
    }
    snap = await snap.limit(500).get();

    lastDoc = last(snap.docs);
    const promises = snap.docs.map((doc: any) => {
      const validatedAddress = doc.data()?.validatedAddress;
      if (validatedAddress && typeof validatedAddress === 'string') {
        console.log({ validatedAddress: { [Network.IOTA]: doc.data()?.validatedAddress } });
        doc.ref.update({ validatedAddress: { [Network.IOTA]: doc.data()?.validatedAddress } });
      }
    });
    await Promise.all(promises);
  } while (lastDoc !== undefined);
};

// Records.
rolValidatedAddress(COL.MEMBER);
rolValidatedAddress(COL.SPACE);
