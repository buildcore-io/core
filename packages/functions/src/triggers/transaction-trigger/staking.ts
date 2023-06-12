import { COL, Stake, SUB_COL, Transaction } from '@build5/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { onStakeCreated } from '../../services/stake.service';

export const onStakingConfirmed = async (billPayment: Transaction) => {
  const stakeDocRef = soonDb().doc(`${COL.STAKE}/${billPayment.payload.stake}`);
  const stake = (await stakeDocRef.get<Stake>())!;

  await soonDb().runTransaction((transaction) => onStakeCreated(transaction, stake));

  const batch = soonDb().batch();

  const updateData = {
    stakes: {
      [stake.type]: {
        amount: soonDb().inc(stake.amount),
        totalAmount: soonDb().inc(stake.amount),
        value: soonDb().inc(stake.value),
        totalValue: soonDb().inc(stake.value),
      },
    },
    stakeExpiry: {
      [stake.type]: {
        [stake.expiresAt.toMillis()]: stake.value,
      },
    },
  };

  const tokenUid = billPayment.payload.token;
  const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${tokenUid}/${SUB_COL.STATS}/${tokenUid}`);
  batch.set(tokenDocRef, { stakes: updateData.stakes }, true);

  const distirbutionDocRef = soonDb().doc(
    `${COL.TOKEN}/${tokenUid}/${SUB_COL.DISTRIBUTION}/${billPayment.member}`,
  );
  batch.set(
    distirbutionDocRef,
    {
      parentId: tokenUid,
      parentCol: COL.TOKEN,
      uid: billPayment.member,
      ...updateData,
    },
    true,
  );

  await batch.commit();
};
