import { COL, Transaction, TransactionType } from '@soonaverse/interfaces';
import { setTokenSymbolOnTransactions } from '../../../scripts/dbUpgrades/0_18/token.symbol.roll';
import admin from '../../../src/admin.config';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';
import { getRandomSymbol } from '../../controls/common';

describe('Token symbol roll', () => {
  it('Should set token symbol', async () => {
    const token = { uid: getRandomEthAddress(), symbol: getRandomSymbol() };
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
    await tokenDocRef.create(token);

    const types = [TransactionType.PAYMENT, TransactionType.BILL_PAYMENT, TransactionType.CREDIT];
    const transactions = types.map((type) => ({
      uid: getRandomEthAddress(),
      type,
      payload: { token: token.uid },
    }));
    const promises = transactions.map(async (transaction) => {
      const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${transaction.uid}`);
      await docRef.create(transaction);
    });
    await Promise.all(promises);

    await setTokenSymbolOnTransactions(admin.app());

    for (const transaction of transactions) {
      const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${transaction.uid}`);
      const data = <Transaction>(await docRef.get()).data();
      expect(data.payload.tokenSymbol).toBe(token.symbol);
    }
  });
});
