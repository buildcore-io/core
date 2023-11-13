import { build5App, build5Db } from '@build-5/database';
import { COL, SOON_PROJECT_ID, TokenPurchase, TokenPurchaseAge } from '@build-5/interfaces';
import { ageRoll } from '../../scripts/dbUpgrades/1.0.0/age.roll';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Age roll test', () => {
  it('Should roll purhcase age', async () => {
    const purchases = [
      { uid: getRandomEthAddress(), age: { [TokenPurchaseAge.IN_24_H]: true } },
      {
        uid: getRandomEthAddress(),
        age: { [TokenPurchaseAge.IN_24_H]: true, [TokenPurchaseAge.IN_48_H]: true },
      },
      {
        uid: getRandomEthAddress(),
        age: { [TokenPurchaseAge.IN_7_D]: true, [TokenPurchaseAge.IN_48_H]: true },
      },
    ];

    for (const p of purchases) {
      const docRef = build5Db().doc(`${COL.TOKEN_PURCHASE}/${p.uid}`);
      await docRef.create({ project: SOON_PROJECT_ID, ...p });
    }

    await ageRoll(build5App);

    let docRef = build5Db().doc(`${COL.TOKEN_PURCHASE}/${purchases[0].uid}`);
    let purchase = await docRef.get<TokenPurchase>();
    expect(purchase?.age).toEqual([TokenPurchaseAge.IN_24_H]);

    docRef = build5Db().doc(`${COL.TOKEN_PURCHASE}/${purchases[1].uid}`);
    purchase = await docRef.get<TokenPurchase>();
    expect(purchase?.age).toEqual([TokenPurchaseAge.IN_24_H, TokenPurchaseAge.IN_48_H]);

    docRef = build5Db().doc(`${COL.TOKEN_PURCHASE}/${purchases[2].uid}`);
    purchase = await docRef.get<TokenPurchase>();
    expect(purchase?.age).toEqual([TokenPurchaseAge.IN_48_H, TokenPurchaseAge.IN_7_D]);
  });
});
