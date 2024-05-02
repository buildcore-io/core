import { PgTokenStatsUpdate, PgTransaction, database } from '@buildcore/database';
import { COL, SUB_COL } from '@buildcore/interfaces';
import { onStakeCreated } from '../../services/stake.service';

export const onStakingConfirmed = async (billPayment: PgTransaction) => {
  const stakeDocRef = database().doc(COL.STAKE, billPayment.payload_stake!);
  const stake = (await stakeDocRef.get())!;

  await database().runTransaction((transaction) => onStakeCreated(transaction, stake));

  const tokenUid = billPayment.payload_token;

  const batch = database().batch();

  const updateData: PgTokenStatsUpdate = {
    [`stakes_${stake.type}_amount`]: database().inc(stake.amount),
    [`stakes_${stake.type}_totalAmount`]: database().inc(stake.amount),
    [`stakes_${stake.type}_value`]: database().inc(stake.value),
    [`stakes_${stake.type}_totalValue`]: database().inc(stake.value),
    stakeExpiry: { [stake.type]: { [stake.expiresAt.toMillis()]: stake.value } },
    parentId: tokenUid!,
  };

  const tokenDocRef = database().doc(COL.TOKEN, tokenUid!, SUB_COL.STATS, tokenUid);
  batch.upsert(tokenDocRef, updateData);

  const distirbutionDocRef = database().doc(
    COL.TOKEN,
    tokenUid!,
    SUB_COL.DISTRIBUTION,
    billPayment.member,
  );
  batch.upsert(distirbutionDocRef, updateData);

  await batch.commit();
};
