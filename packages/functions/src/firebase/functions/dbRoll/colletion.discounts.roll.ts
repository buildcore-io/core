import { COL, DiscountLineDeprecated } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { isEmpty, last } from 'lodash';
import admin from '../../../admin.config';
import { LastDocType } from '../../../utils/common.utils';
import { xpTokenId } from '../../../utils/config.utils';
import { uOn } from '../../../utils/dateTime.utils';
import { getTokenByMintId } from '../../../utils/token.utils';
import { XP_TO_SHIMMER } from './award.roll';

export const collectionDiscountRoll = functions
  .runWith({ maxInstances: 1, timeoutSeconds: 540 })
  .https.onRequest(async (req, res) => {
    const selectedCollections = (req.body.collections || []) as string[];
    if (selectedCollections.length > 10) {
      res.sendStatus(400);
      return;
    }

    let lastDoc: LastDocType | undefined = undefined;

    const token = (await getTokenByMintId(xpTokenId()))!;
    do {
      let query = admin.firestore().collection(COL.COLLECTION).limit(500);
      if (!isEmpty(selectedCollections)) {
        query = query.where(admin.firestore.FieldPath.documentId(), 'in', selectedCollections);
      }
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      const snap = await query.get();
      lastDoc = last(snap.docs);

      const batch = admin.firestore().batch();

      snap.docs.forEach((doc) => {
        const discounts = ((doc.data()?.discounts || []) as DiscountLineDeprecated[]).map((d) => ({
          tokenUid: token.uid,
          tokenSymbol: token.symbol,
          tokenReward: d.xp * XP_TO_SHIMMER,
          amount: d.amount,
        }));
        batch.update(doc.ref, uOn({ discounts }));
      });

      await batch.commit();
    } while (lastDoc);

    res.sendStatus(200);
  });
