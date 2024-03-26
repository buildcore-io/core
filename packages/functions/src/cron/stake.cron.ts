import { build5Db } from '@build-5/database';
import { COL, SUB_COL } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { onStakeExpired } from '../services/stake.service';

export const removeExpiredStakesFromSpace = async () => {
  const snap = await build5Db()
    .collection(COL.STAKE)
    .where('expiresAt', '<=', dayjs().toDate())
    .where('expirationProcessed', '==', false)
    .get();

  const promises = snap.map((d) => updateTokenStakeStats(d.uid));
  await Promise.all(promises);
};

const updateTokenStakeStats = (stakeId: string) =>
  build5Db().runTransaction(async (transaction) => {
    const stakeDocRef = build5Db().doc(COL.STAKE, stakeId);
    const stake = (await transaction.get(stakeDocRef))!;
    if (stake.expirationProcessed) {
      return;
    }

    await onStakeExpired(transaction, stake);

    const updateData = {
      [`stakes_${stake.type}_amount`]: build5Db().inc(-stake.amount),
      [`stakes_${stake.type}_value`]: build5Db().inc(-stake.value),
      stakeExpiry: { [stake.type]: { [stake.expiresAt.toMillis()]: null } },
    };
    const spaceDocRef = build5Db().doc(COL.TOKEN, stake.token, SUB_COL.STATS, stake.token);
    await transaction.upsert(spaceDocRef, updateData);

    const distributionDocRef = build5Db().doc(
      COL.TOKEN,
      stake.token,
      SUB_COL.DISTRIBUTION,
      stake.member,
    );
    await transaction.upsert(distributionDocRef, updateData);

    await transaction.update(stakeDocRef, { expirationProcessed: true });
  });
