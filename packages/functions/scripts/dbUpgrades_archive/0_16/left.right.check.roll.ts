/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Stake, StakeReward } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import serviceAccount from '../../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(serviceAccount as any),
});

const db = getFirestore();

const setLeftRightCheck = async (col: COL.STAKE | COL.STAKE_REWARD) => {
  let lastDoc: any | undefined = undefined;
  let count = 0;
  do {
    let query = db.collection(col).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const batch = db.batch();
    snap.docs.forEach((d) => {
      if (d.data().leftCheck && d.data().rightCheck) {
        return;
      }
      ++count;
      if (col === COL.STAKE) {
        const data = <Stake>d.data();
        batch.update(d.ref, {
          leftCheck: dayjs(data.expiresAt.toDate()).valueOf(),
          rightCheck: dayjs(data.createdOn!.toDate()).valueOf(),
        });
      } else {
        const data = <StakeReward>d.data();
        batch.update(d.ref, {
          leftCheck: dayjs(data.startDate.toDate()).valueOf(),
          rightCheck: dayjs(data.endDate.toDate()).valueOf(),
        });
      }
    });
    await batch.commit();
  } while (lastDoc !== undefined);
  console.log(`${count} docs modified`);
};

setLeftRightCheck(COL.STAKE);
setLeftRightCheck(COL.STAKE_REWARD);
