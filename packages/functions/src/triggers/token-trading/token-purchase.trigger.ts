import { COL, SUB_COL, TokenPurchase, WEN_FUNC } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { soonDb } from '../../firebase/firestore/soondb';
import { scale } from '../../scale.settings';

export const onTokenPurchaseCreated = functions
  .runWith({ minInstances: scale(WEN_FUNC.onTokenPurchaseCreated) })
  .firestore.document(COL.TOKEN_PURCHASE + '/{docId}')
  .onCreate(async (snap) => {
    const data = <TokenPurchase>snap.data();
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
  });
