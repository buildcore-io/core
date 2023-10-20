import { COL, SUB_COL, TokenPurchase, TokenPurchaseAge } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { FirestoreDocEvent } from '../common';

export const onTokenPurchaseCreated = async (event: FirestoreDocEvent<TokenPurchase>) => {
  const { curr } = event;
  if (!curr || !curr.token) {
    return;
  }
  const batch = build5Db().batch();

  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${curr.token}`);
  const statsDocRef = tokenDocRef.collection(SUB_COL.STATS).doc(curr.token);
  const volume = Object.values(TokenPurchaseAge).reduce(
    (acc, act) => ({ ...acc, [act]: build5Db().inc(curr.count) }),
    {},
  );
  const statsData = {
    parentId: curr.token,
    parentCol: COL.TOKEN,
    volumeTotal: build5Db().inc(curr.count),
    volume,
  };
  batch.set(statsDocRef, statsData, true);

  const purchaseDocRef = build5Db().doc(`${COL.TOKEN_PURCHASE}/${curr.uid}`);
  const age = Object.values(TokenPurchaseAge).reduce((acc, act) => ({ ...acc, [act]: true }), {});
  batch.update(purchaseDocRef, { age });

  await batch.commit();
};
