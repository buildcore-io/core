import { build5Db } from '@build-5/database';
import { COL, SUB_COL, TokenPurchase, TokenPurchaseAge } from '@build-5/interfaces';
import { FirestoreDocEvent } from '../common';

export const onTokenPurchaseCreated = async (event: FirestoreDocEvent<TokenPurchase>) => {
  const { curr } = event;
  if (!curr || !curr.token) {
    return;
  }

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
  statsDocRef.set(statsData, true);
};
