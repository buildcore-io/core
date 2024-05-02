import { database } from '@buildcore/database';
import { COL, SUB_COL, TokenPurchaseAge } from '@buildcore/interfaces';
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
    const batch = database().batch();
    for (const purchase of purchases) {
      const docRef = database().doc(COL.TOKEN_PURCHASE, purchase.uid);
      batch.update(docRef, { [age]: false });

      const token = purchase.token;
      const statsDocRef = database().doc(COL.TOKEN, token, SUB_COL.STATS, token);
      batch.upsert(statsDocRef, { [`volume_${age}`]: database().inc(-purchase.count) });
    }
    await batch.commit();
  }
};

const getExpiredPurchases = (age: TokenPurchaseAge) => {
  const days = toknePurchaseAgeToDayCount(age);
  const createdBefore = dayjs().subtract(days, 'd').toDate();
  return database()
    .collection(COL.TOKEN_PURCHASE)
    .where(age, '==', true)
    .where('createdOn', '<=', createdBefore)
    .get();
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
