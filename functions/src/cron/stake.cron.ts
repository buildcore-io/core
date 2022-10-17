import dayjs from 'dayjs';
import { last } from 'lodash';
import { Stake } from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';
import admin from '../admin.config';
import { LastDocType } from '../utils/common.utils';
import { dateToTimestamp } from '../utils/dateTime.utils';

export const removeExpiredStakesFromSpace = async () => {
  let lastDoc: LastDocType | undefined = undefined;
  do {
    const query = getExpiredStakeQuery(lastDoc);
    const snap = await query.get();

    const promises = snap.docs.map((d) => updateSpace(d.id));
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

const updateSpace = async (stakeId: string) =>
  admin.firestore().runTransaction(async (transaction) => {
    const stakeDocRef = admin.firestore().doc(`${COL.STAKE}/${stakeId}`);
    const stake = <Stake>(await transaction.get(stakeDocRef)).data();
    if (stake.expirationProcessed) {
      return;
    }
    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${stake.space}`);
    transaction.update(spaceDocRef, {
      'staked.amount': admin.firestore.FieldValue.increment(-stake.amount),
      'staked.value': admin.firestore.FieldValue.increment(-stake.value),
    });
    transaction.update(stakeDocRef, { expirationProcessed: true });
  });
