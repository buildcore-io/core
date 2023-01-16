import { COL, Stake, SUB_COL, Transaction } from '@soonaverse/interfaces';
import admin, { inc } from '../../admin.config';
import { onStakeCreated } from '../../services/stake.service';
import { uOn } from '../../utils/dateTime.utils';

export const onStakingConfirmed = async (billPayment: Transaction) => {
  const stakeDocRef = admin.firestore().doc(`${COL.STAKE}/${billPayment.payload.stake}`);
  const stake = (await stakeDocRef.get()).data() as Stake;

  await admin.firestore().runTransaction((transaction) => onStakeCreated(transaction, stake));

  const batch = admin.firestore().batch();

  const updateData = {
    stakes: {
      [stake.type]: {
        amount: inc(stake.amount),
        totalAmount: inc(stake.amount),
        value: inc(stake.value),
        totalValue: inc(stake.value),
      },
    },
    stakeExpiry: {
      [stake.type]: {
        [stake.expiresAt.toMillis()]: stake.value,
      },
    },
  };

  const tokenUid = billPayment.payload.token;
  const tokenDocRef = admin
    .firestore()
    .doc(`${COL.TOKEN}/${tokenUid}/${SUB_COL.STATS}/${tokenUid}`);
  batch.set(tokenDocRef, uOn({ stakes: updateData.stakes }), { merge: true });

  const distirbutionDocRef = admin
    .firestore()
    .doc(`${COL.TOKEN}/${tokenUid}/${SUB_COL.DISTRIBUTION}/${billPayment.member}`);
  batch.set(
    distirbutionDocRef,
    uOn({
      parentId: tokenUid,
      parentCol: COL.TOKEN,
      uid: billPayment.member,
      ...updateData,
    }),
    { merge: true },
  );

  await batch.commit();
};
