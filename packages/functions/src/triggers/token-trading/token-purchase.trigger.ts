import { COL, SUB_COL, TokenPurchase, WEN_FUNC_TRIGGER } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions/v2';
import { soonDb } from '../../firebase/firestore/soondb';
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
    await soonDb()
      .doc(`${COL.TOKEN}/${data.token}/${SUB_COL.STATS}/${data.token}`)
      .set(
        {
          parentId: data.token,
          parentCol: COL.TOKEN,
          volumeTotal: soonDb().inc(data.count),
        },
        true,
      );
  },
);
