import { COL, Transaction, TransactionIgnoreWalletReason } from '@soonaverse/interfaces';
import { ignoreWalletRoll } from '../../../scripts/dbUpgrades/0.19/ignore.wallet.roll';
import { soonApp } from '../../../src/firebase/app/soonApp';
import { soonDb } from '../../../src/firebase/firestore/soondb';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

describe('Ignore wallet roll', () => {
  it('Should roll ignore wallet', async () => {
    const trans = [
      { uid: getRandomEthAddress(), payload: { ignoreWallet: false } },
      {
        uid: getRandomEthAddress(),
        payload: {
          ignoreWallet: true,
          ignoreWalletReason:
            TransactionIgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION,
        },
      },
      { uid: getRandomEthAddress() },
    ];
    for (const tran of trans) {
      const docRef = soonDb().doc(`${COL.TRANSACTION}/${tran.uid}`);
      await docRef.create(tran);
    }

    await ignoreWalletRoll(soonApp());

    let tran = await soonDb().doc(`${COL.TRANSACTION}/${trans[0].uid}`).get<Transaction>();
    expect(tran?.ignoreWallet).toBe(false);
    expect(tran?.ignoreWalletReason).toBe('');
    expect(tran?.payload?.ignoreWallet).toBeUndefined();
    expect(tran?.payload?.ignoreWalletReason).toBeUndefined();

    tran = await soonDb().doc(`${COL.TRANSACTION}/${trans[1].uid}`).get<Transaction>();
    expect(tran?.ignoreWallet).toBe(true);
    expect(tran?.ignoreWalletReason).toBe(
      TransactionIgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION,
    );
    expect(tran?.payload?.ignoreWallet).toBeUndefined();
    expect(tran?.payload?.ignoreWalletReason).toBeUndefined();

    tran = await soonDb().doc(`${COL.TRANSACTION}/${trans[2].uid}`).get<Transaction>();
    expect(tran?.ignoreWallet).toBeUndefined();
    expect(tran?.ignoreWalletReason).toBeUndefined();
  });
});
