import { COL, Stake, SUB_COL, Transaction } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { onStakeCreated } from '../../services/stake.service';

export const onStakingConfirmed = async (billPayment: Transaction) => {
  const stakeDocRef = build5Db().doc(`${COL.STAKE}/${billPayment.payload.stake}`);
  const stake = (await stakeDocRef.get<Stake>())!;

  await build5Db().runTransaction((transaction) => onStakeCreated(transaction, stake));

  const batch = build5Db().batch();

  const updateData = {
    stakes: {
      [stake.type]: {
        amount: build5Db().inc(stake.amount),
        totalAmount: build5Db().inc(stake.amount),
        value: build5Db().inc(stake.value),
        totalValue: build5Db().inc(stake.value),
      },
    },
    stakeExpiry: {
      [stake.type]: {
        [stake.expiresAt.toMillis()]: stake.value,
      },
    },
  };

  const tokenUid = billPayment.payload.token;
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${tokenUid}/${SUB_COL.STATS}/${tokenUid}`);
  batch.set(tokenDocRef, { stakes: updateData.stakes }, true);

  const distirbutionDocRef = build5Db().doc(
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
