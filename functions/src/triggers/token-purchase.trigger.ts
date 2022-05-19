import * as functions from 'firebase-functions';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { TokenPurchase } from '../../interfaces/models/token';
import admin from '../admin.config';

export const onTokenPurchaseCreated = functions.firestore.document(COL.TOKEN_PURCHASE + '/{docId}').onCreate(async (snap) => {
  const data = <TokenPurchase>snap.data()
  await admin.firestore()
    .doc(`${COL.TOKEN}/${data.token}/${SUB_COL.STATS}/${data.token}`)
    .set({
      parentId: data.token,
      parentCol: COL.TOKEN,
      volumeTotal: admin.firestore.FieldValue.increment(data.count)
    }, { merge: true })
})
