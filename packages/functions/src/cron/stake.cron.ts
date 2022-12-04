import { COL, Stake, SUB_COL } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { last } from 'lodash';
import admin, { inc } from '../admin.config';
import { onStakeExpired } from '../services/stake.service';
import { LastDocType } from '../utils/common.utils';
import { dateToTimestamp, uOn } from '../utils/dateTime.utils';

export const removeExpiredStakesFromSpace = async () => {
  let lastDoc: LastDocType | undefined = undefined;
  do {
    const query = getExpiredStakeQuery(lastDoc);
    const snap = await query.get();

    const promises = snap.docs.map((d) => updateTokenStakeStats(d.id));
    await Promise.all(promises);

    lastDoc = last(snap.docs);
  } while (lastDoc);
};

const getExpiredStakeQuery = (lastDoc?: LastDocType) => {
  const query = admin
    .firestore()
    .collection(COL.STAKE)
    .where('expiresAt', '<=', dateToTimestamp(dayjs().toDate()))
    .where('expirationProcessed', '==', false)
    .limit(1000);
  if (lastDoc) {
    return query.startAfter(lastDoc);
  }
  return query;
};

const updateTokenStakeStats = async (stakeId: string) =>
  admin.firestore().runTransaction(async (transaction) => {
    const stakeDocRef = admin.firestore().doc(`${COL.STAKE}/${stakeId}`);
    const stake = (await transaction.get(stakeDocRef)).data() as Stake;
    if (stake.expirationProcessed) {
      return;
    }

    await onStakeExpired(transaction, stake);

    const updateData = {
      stakes: {
        [stake.type]: {
          amount: inc(-stake.amount),
          value: inc(-stake.value),
        },
      },
      stakeExpiry: {
        [stake.type]: {
          [stake.expiresAt.toMillis()]: admin.firestore.FieldValue.delete(),
        },
      },
    };
    const spaceDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${stake.token}/${SUB_COL.STATS}/${stake.token}`);
    transaction.set(spaceDocRef, uOn(updateData), { merge: true });

    const spaceMemberDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${stake.token}/${SUB_COL.DISTRIBUTION}/${stake.member}`);
    transaction.set(spaceMemberDocRef, uOn(updateData), { merge: true });

    transaction.update(stakeDocRef, { expirationProcessed: true });
  });
