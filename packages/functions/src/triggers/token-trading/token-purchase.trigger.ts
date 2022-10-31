import { COL, SUB_COL, TokenPurchase, WEN_FUNC } from '@soon/interfaces';
import * as functions from 'firebase-functions';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { uOn } from '../../utils/dateTime.utils';

export const onTokenPurchaseCreated = functions
  .runWith({ minInstances: scale(WEN_FUNC.onTokenPurchaseCreated) })
  .firestore.document(COL.TOKEN_PURCHASE + '/{docId}')
  .onCreate(async (snap) => {
    const data = <TokenPurchase>snap.data();
    if (!data.token) {
      return;
    }
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${data.token}/${SUB_COL.STATS}/${data.token}`)
      .set(
        uOn({
          parentId: data.token,
          parentCol: COL.TOKEN,
          volumeTotal: admin.firestore.FieldValue.increment(data.count),
        }),
        { merge: true },
      );
  });
