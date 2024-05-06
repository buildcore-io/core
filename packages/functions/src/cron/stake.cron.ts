import { database } from '@buildcore/database';
import { COL, SUB_COL } from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { onStakeExpired } from '../services/stake.service';

export const removeExpiredStakesFromSpace = async () => {
  const snap = await database()
    .collection(COL.STAKE)
    .where('expiresAt', '<=', dayjs().toDate())
    .where('expirationProcessed', '==', false)
    .get();

  const promises = snap.map((d) => updateTokenStakeStats(d.uid));
  await Promise.all(promises);
};

const updateTokenStakeStats = (stakeId: string) =>
  database().runTransaction(async (transaction) => {
    const stakeDocRef = database().doc(COL.STAKE, stakeId);
    const stake = (await transaction.get(stakeDocRef))!;
    if (stake.expirationProcessed) {
      return;
    }

    await onStakeExpired(transaction, stake);

    const updateData = {
      [`stakes_${stake.type}_amount`]: database().inc(-stake.amount),
      [`stakes_${stake.type}_value`]: database().inc(-stake.value),
      stakeExpiry: { [stake.type]: { [stake.expiresAt.toMillis()]: null } },
    };
    const spaceDocRef = database().doc(COL.TOKEN, stake.token, SUB_COL.STATS, stake.token);
    await transaction.upsert(spaceDocRef, updateData);

    const distributionDocRef = database().doc(
      COL.TOKEN,
      stake.token,
      SUB_COL.DISTRIBUTION,
      stake.member,
    );
    await transaction.upsert(distributionDocRef, updateData);

    await transaction.update(stakeDocRef, { expirationProcessed: true });
  });
