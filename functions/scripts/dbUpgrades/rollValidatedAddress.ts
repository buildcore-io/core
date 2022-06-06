import { Network } from '@functions/interfaces/models';
import { COL } from '@functions/interfaces/models/base';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import serviceAccount from '../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(<any>serviceAccount)
});

const db = getFirestore();

export const rolValidatedAddress = async (collection: COL) => {
  let lastDoc: any
  do {
    const snap = await db.collection(collection).orderBy('createdOn').startAfter(lastDoc).limit(500).get()
    lastDoc = last(snap.docs)
    const promises = snap.docs.map(doc => {
      const validatedAddress = doc.data()?.validatedAddress
      if (validatedAddress && typeof validatedAddress === 'string') {
        doc.ref.update({ validatedAddress: { [Network.IOTA]: doc.data()?.validatedAddress } })
      }
    })
    await Promise.all(promises)
  } while (lastDoc !== undefined)
}
