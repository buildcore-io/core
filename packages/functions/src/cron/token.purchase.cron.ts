import { build5Db } from '@build-5/database';
import { COL, SUB_COL, TokenPurchase, TokenPurchaseAge } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { chunk } from 'lodash';

export const removePurchasesFromVolumeStats = async () => {
  for (const age of Object.values(TokenPurchaseAge)) {
    await removeExiredPurchaseFromStats(age);
  }
};

const removeExiredPurchaseFromStats = async (age: TokenPurchaseAge) => {
  const allPurchases = await getExpiredPurchases(age);
  const chunks = chunk(allPurchases, 250);
  for (const purchases of chunks) {
    const batch = build5Db().batch();
    for (const purchase of purchases) {
      const docRef = build5Db().doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`);
      batch.set(docRef, { age: build5Db().arrayRemove(age) }, true);

      const token = purchase.token;
      const statsDocRef = build5Db().doc(`${COL.TOKEN}/${token}/${SUB_COL.STATS}/${token}`);
      batch.set(statsDocRef, { volume: { [age]: build5Db().inc(-purchase.count) } }, true);
    }
    await batch.commit();
  }
};

const getExpiredPurchases = (age: TokenPurchaseAge) => {
  const days = toknePurchaseAgeToDayCount(age);
  const createdBefore = dayjs().subtract(days, 'd').toDate();
  return build5Db()
    .collection(COL.TOKEN_PURCHASE)
    .where('age', 'array-contains', age)
    .where('createdOn', '<=', createdBefore)
    .get<TokenPurchase>();
};

const toknePurchaseAgeToDayCount = (age: TokenPurchaseAge) => {
  switch (age) {
    case TokenPurchaseAge.IN_24_H:
      return 1;
    case TokenPurchaseAge.IN_48_H:
      return 2;
    case TokenPurchaseAge.IN_7_D:
      return 7;
  }
};
