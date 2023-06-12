import { COL, Stake, SUB_COL } from '@build5/interfaces';
import dayjs from 'dayjs';
import { last } from 'lodash';
import { getSnapshot, soonDb } from '../firebase/firestore/soondb';
import { onStakeExpired } from '../services/stake.service';
import { dateToTimestamp } from '../utils/dateTime.utils';

export const removeExpiredStakesFromSpace = async () => {
  let lastDocId = '';
  do {
    const query = await getExpiredStakeQuery(lastDocId);
    const snap = await query.get<Stake>();
    lastDocId = last(snap)?.uid || '';

    const promises = snap.map((d) => updateTokenStakeStats(d.uid));
    await Promise.all(promises);
  } while (lastDocId);
};

const getExpiredStakeQuery = async (lastDocId = '') => {
  const lastDoc = await getSnapshot(COL.STAKE, lastDocId);
  return soonDb()
    .collection(COL.STAKE)
    .where('expiresAt', '<=', dateToTimestamp(dayjs().toDate()))
    .where('expirationProcessed', '==', false)
    .startAfter(lastDoc)
    .limit(1000);
};

const updateTokenStakeStats = async (stakeId: string) =>
  soonDb().runTransaction(async (transaction) => {
    const stakeDocRef = soonDb().doc(`${COL.STAKE}/${stakeId}`);
    const stake = <Stake>await transaction.get(stakeDocRef);
    if (stake.expirationProcessed) {
      return;
    }

    await onStakeExpired(transaction, stake);

    const updateData = {
      stakes: {
        [stake.type]: {
          amount: soonDb().inc(-stake.amount),
          value: soonDb().inc(-stake.value),
        },
      },
      stakeExpiry: {
        [stake.type]: {
          [stake.expiresAt.toMillis()]: soonDb().deleteField(),
        },
      },
    };
    const spaceDocRef = soonDb().doc(`${COL.TOKEN}/${stake.token}/${SUB_COL.STATS}/${stake.token}`);
    transaction.set(spaceDocRef, updateData, true);

    const spaceMemberDocRef = soonDb().doc(
      `${COL.TOKEN}/${stake.token}/${SUB_COL.DISTRIBUTION}/${stake.member}`,
    );
    transaction.set(spaceMemberDocRef, updateData, true);

    transaction.update(stakeDocRef, { expirationProcessed: true });
  });
