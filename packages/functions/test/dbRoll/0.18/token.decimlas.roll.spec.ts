import { COL, Token } from '@soonaverse/interfaces';
import { rollTokenDecimals } from '../../../scripts/dbUpgrades/0.18/token.decimal.roll';
import admin from '../../../src/admin.config';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

describe('Token decimals', () => {
  it('Should set decimals', async () => {
    const tokens = [
      {
        uid: getRandomEthAddress(),
      },
      {
        uid: getRandomEthAddress(),
        decimals: 2,
      },
    ];
    for (const token of tokens) {
      await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).create(token);
    }

    await rollTokenDecimals(admin.app());

    let docRef = admin.firestore().doc(`${COL.TOKEN}/${tokens[0].uid}`);
    let token = (await docRef.get()).data() as Token;
    expect(token.decimals).toBe(6);

    docRef = admin.firestore().doc(`${COL.TOKEN}/${tokens[1].uid}`);
    token = (await docRef.get()).data() as Token;
    expect(token.decimals).toBe(2);
  });
});
