import { COL, SUB_COL, TokenPurchase, TokenPurchaseAge } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { chunk } from 'lodash';
import { soonDb } from '../firebase/firestore/soondb';

export const removePurchasesFromVolumeStats = async () => {
  for (const age of Object.values(TokenPurchaseAge)) {
    await removeExiredPurchaseFromStats(age);
  }
};

const removeExiredPurchaseFromStats = async (age: TokenPurchaseAge) => {
  const allPurchases = await getExpiredPurchases(age);
  const chunks = chunk(allPurchases, 250);
  for (const purchases of chunks) {
    const batch = soonDb().batch();
    for (const purchase of purchases) {
      const docRef = soonDb().doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`);
      batch.set(docRef, { age: { [age]: false } }, true);

      const token = purchase.token;
      const statsDocRef = soonDb().doc(`${COL.TOKEN}/${token}/${SUB_COL.STATS}/${token}`);
      batch.set(statsDocRef, { volume: { [age]: soonDb().inc(-purchase.count) } }, true);
    }
    await batch.commit();
  }
};

const getExpiredPurchases = (age: TokenPurchaseAge) => {
  const days = toknePurchaseAgeToDayCount(age);
  const createdBefore = dayjs().subtract(days, 'd').toDate();
  return soonDb()
    .collection(COL.TOKEN_PURCHASE)
    .where(`age.${age}`, '==', true)
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
