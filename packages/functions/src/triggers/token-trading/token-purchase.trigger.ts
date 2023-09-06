import { build5Db } from '@build-5/database';
import {
  COL,
  SUB_COL,
  TokenPurchase,
  TokenPurchaseAge,
  WEN_FUNC_TRIGGER,
} from '@build-5/interfaces';
import * as functions from 'firebase-functions/v2';
import { scale } from '../../scale.settings';

export const onTokenPurchaseCreated = functions.firestore.onDocumentCreated(
  {
    document: COL.TOKEN_PURCHASE + '/{docId}',
    minInstances: scale(WEN_FUNC_TRIGGER.onTokenPurchaseCreated),
    concurrency: 1000,
  },
  async (event) => {
    const data = <TokenPurchase>event.data!.data();
    if (!data.token) {
      return;
    }
    const batch = build5Db().batch();

    const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${data.token}`);
    const statsDocRef = tokenDocRef.collection(SUB_COL.STATS).doc(data.token);
    const volume = Object.values(TokenPurchaseAge).reduce(
      (acc, act) => ({ ...acc, [act]: build5Db().inc(data.count) }),
      {},
    );
    const statsData = {
      parentId: data.token,
      parentCol: COL.TOKEN,
      volumeTotal: build5Db().inc(data.count),
      volume,
    };
    batch.set(statsDocRef, statsData, true);

    const purchaseDocRef = build5Db().doc(`${COL.TOKEN_PURCHASE}/${data.uid}`);
    const age = Object.values(TokenPurchaseAge).reduce((acc, act) => ({ ...acc, [act]: true }), {});
    batch.update(purchaseDocRef, { age });

    await batch.commit();
  },
);
