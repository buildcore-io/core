import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { Network } from '../../interfaces/models';
import { COL } from "../../interfaces/models/base";
import serviceAccount from '../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

export const rollNetwork = async (fieldName: 'sourceNetwork' | 'targetNetwork') => {
  const query = db.collection(COL.TRANSACTION).where(fieldName, 'in', Object.values(Network)).limit(500)
  let snapSize = 0
  do {
    const snap = await query.get()
    const promises = snap.docs.map(doc =>
      doc.ref.update({
        network: doc.data()[fieldName],
        sourceNetwork: FieldValue.delete(),
        targetNetwork: FieldValue.delete()
      })
    )
    await Promise.allSettled(promises)
    snapSize = snap.size
  } while (snapSize > 0)
}

rollNetwork('targetNetwork');
rollNetwork('sourceNetwork');
