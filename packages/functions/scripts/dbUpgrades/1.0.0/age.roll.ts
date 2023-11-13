import { FirebaseApp, Firestore } from '@build-5/database';
import { COL, TokenPurchase, TokenPurchaseAge } from '@build-5/interfaces';
import { last } from 'lodash';

export const ageRoll = async (app: FirebaseApp) => {
  const db = new Firestore(app);
  let lastDocId = '';

  do {
    const lastDoc = lastDocId
      ? await db.doc(`${COL.TOKEN_PURCHASE}/${lastDocId}`).getSnapshot()
      : undefined;
    const purchases = await db
      .collection(COL.TOKEN_PURCHASE)
      .startAfter(lastDoc)
      .limit(500)
      .get<TokenPurchase>();
    lastDocId = last(purchases)?.uid || '';

    const batch = db.batch();

    purchases.forEach((purchase) => {
      if (Array.isArray(purchase.age)) {
        return;
      }
      const prevAge = purchase.age as Record<string, TokenPurchaseAge>;
      const age = Object.values(TokenPurchaseAge).reduce(
        (acc, act) => (prevAge[act] ? [...acc, act] : acc),
        [] as TokenPurchaseAge[],
      );
      const docRef = db.doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`);
      batch.update(docRef, { age });
    });

    await batch.commit();
  } while (lastDocId);
};

export const roll = ageRoll;
