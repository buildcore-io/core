/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, SUB_COL, TokenDistribution } from '@soonaverse/interfaces';
// import { App, cert, initializeApp } from 'firebase-admin/app';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const setExtrasStakes = async (
  app: App,
  extraStakes: { [key: string]: number },
  token: string,
) => {
  const db = getFirestore(app);
  for (const [key, value] of Object.entries(extraStakes)) {
    const ditributionDocRef = db.doc(`${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${key}`);
    const distribution = <TokenDistribution>(await ditributionDocRef.get()).data();
    if (distribution.extraStakeRewards !== undefined) {
      return;
    }
    await ditributionDocRef.update({ extraStakeRewards: value });
  }
};

// const run = async () => {
//   const serviceAccount = await import('../../serviceAccountKey.json');
//   const extraStakes = await import('./extra.stakes.json');
//   const app = initializeApp({
//     credential: cert(serviceAccount.default as any),
//   });
//   await setExtrasStakes(app, extraStakes.extra, extraStakes.token);
// };

// run();
