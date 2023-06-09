import { COL, SUB_COL, TokenPurchaseAge, TokenStats } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { tokenPurchaseRoll } from '../../scripts/dbUpgrades/0.20/tokenPurchaseRoll';
import { removePurchasesFromVolumeStats } from '../../src/cron/token.purchase.cron';
import { soonApp } from '../../src/firebase/app/soonApp';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Token purchase roll', () => {
  let token: string = '';
  beforeEach(() => {
    token = getRandomEthAddress();
  });

  it('Should roll token purchase volume stats', async () => {
    const purchases = [
      { uid: getRandomEthAddress(), token, count: 1, createdOn: dayjs().subtract(9, 'd').toDate() },
      { uid: getRandomEthAddress(), token, count: 1, createdOn: dayjs().subtract(5, 'd').toDate() },
      { uid: getRandomEthAddress(), token, count: 1, createdOn: dayjs().subtract(2, 'h').toDate() },
    ];

    for (const purchase of purchases) {
      const docRef = soonDb().doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`);
      await docRef.create(purchase);
    }

    await tokenPurchaseRoll(soonApp());

    const statsDocRef = soonDb().doc(`${COL.TOKEN}/${token}/${SUB_COL.STATS}/${token}`);
    let stats = await statsDocRef.get<TokenStats>();
    expect(stats?.volume[TokenPurchaseAge.IN_7_D]).toBe(2);
    expect(stats?.volume[TokenPurchaseAge.IN_24_H]).toBe(2);

    await expectStats(2, 1);

    let docRef = soonDb().doc(`${COL.TOKEN_PURCHASE}/${purchases[1].uid}`);
    await docRef.update({ createdOn: dayjs().subtract(9, 'd').toDate() });
    docRef = soonDb().doc(`${COL.TOKEN_PURCHASE}/${purchases[2].uid}`);
    await docRef.update({ createdOn: dayjs().subtract(3, 'd').toDate() });

    await expectStats(1, 0);

    docRef = soonDb().doc(`${COL.TOKEN_PURCHASE}/${purchases[2].uid}`);
    await docRef.update({ createdOn: dayjs().subtract(9, 'd').toDate() });

    await expectStats(0, 0);
  });

  const expectStats = async (volume7d: number, volume24h: number) => {
    await removePurchasesFromVolumeStats();
    const statsDocRef = soonDb().doc(`${COL.TOKEN}/${token}/${SUB_COL.STATS}/${token}`);
    const stats = await statsDocRef.get<TokenStats>();
    expect(stats?.volume[TokenPurchaseAge.IN_7_D]).toBe(volume7d);
    expect(stats?.volume[TokenPurchaseAge.IN_24_H]).toBe(volume24h);
  };
});