import { COL } from '@build-5/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();

export const rollNetwork = async (members: string[]) => {
  members.forEach(async (m) => {
    const ss: any = await db.collection(COL.MEMBER).doc(m).get();
    if (ss.data() && ss.data().tokenTradingFeePercentage !== 0) {
      console.log(m + ' member to zero.');

      return ss.ref.update({
        tokenTradingFeePercentage: 0,
      });
    }
  });

  return undefined;
};

const members: string[] = [];
rollNetwork(members);
