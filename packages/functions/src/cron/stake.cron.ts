import { COL, Stake, SUB_COL } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { last } from 'lodash';
import { build5Db, getSnapshot } from '../firebase/firestore/build5Db';
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
  return build5Db()
    .collection(COL.STAKE)
    .where('expiresAt', '<=', dateToTimestamp(dayjs().toDate()))
    .where('expirationProcessed', '==', false)
    .startAfter(lastDoc)
    .limit(1000);
};

const updateTokenStakeStats = async (stakeId: string) =>
  build5Db().runTransaction(async (transaction) => {
    const stakeDocRef = build5Db().doc(`${COL.STAKE}/${stakeId}`);
    const stake = <Stake>await transaction.get(stakeDocRef);
    if (stake.expirationProcessed) {
      return;
    }

    await onStakeExpired(transaction, stake);

    const updateData = {
      stakes: {
        [stake.type]: {
          amount: build5Db().inc(-stake.amount),
          value: build5Db().inc(-stake.value),
        },
      },
      stakeExpiry: {
        [stake.type]: {
          [stake.expiresAt.toMillis()]: build5Db().deleteField(),
        },
      },
    };
    const spaceDocRef = build5Db().doc(
      `${COL.TOKEN}/${stake.token}/${SUB_COL.STATS}/${stake.token}`,
    );
    transaction.set(spaceDocRef, updateData, true);

    const spaceMemberDocRef = build5Db().doc(
      `${COL.TOKEN}/${stake.token}/${SUB_COL.DISTRIBUTION}/${stake.member}`,
    );
    transaction.set(spaceMemberDocRef, updateData, true);

    transaction.update(stakeDocRef, { expirationProcessed: true });
  });
