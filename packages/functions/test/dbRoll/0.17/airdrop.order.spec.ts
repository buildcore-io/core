import { COL, Transaction, TransactionOrderType } from '@soonaverse/interfaces';
import { migrateAirdropOrders } from '../../../scripts/dbUpgrades/0_17/airdrop.order.roll';
import admin from '../../../src/admin.config';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

describe('Test airdrop order roll', () => {
  it('Should roll airdrop order', async () => {
    const orders = [
      {
        uid: getRandomEthAddress(),
        payload: {
          type: TransactionOrderType.AIRDROP_MINTED_TOKEN,
          drops: [{ count: 100 }, { count: 20 }, { count: 3 }],
        },
      },
      {
        uid: getRandomEthAddress(),
        payload: {
          type: TransactionOrderType.AIRDROP_MINTED_TOKEN,
          drops: [],
        },
      },
    ];
    for (const order of orders) {
      await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
    }

    await migrateAirdropOrders(admin.app());

    for (const order of orders) {
      const data = <Transaction>(
        (await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).get()).data()
      );
      expect(data.payload.totalAirdropCount).toBe(
        order.payload.drops.reduce((acc, act) => acc + act.count, 0),
      );
      expect(data.payload.unclaimedAirdrops).toBe(order.payload.drops.length);
      expect(data.payload.drops).toBeUndefined();
    }
  });

  it('Should not modify if already set', async () => {
    const order = {
      uid: getRandomEthAddress(),
      payload: {
        type: TransactionOrderType.AIRDROP_MINTED_TOKEN,
        unclaimedAirdrops: 10,
        totalAirdropCount: 10,
      },
    };
    await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
    await migrateAirdropOrders(admin.app());

    const data = <Transaction>(
      (await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).get()).data()
    );
    expect(data.payload.totalAirdropCount).toBe(10);
    expect(data.payload.unclaimedAirdrops).toBe(10);
    expect(data.payload.drops).toBeUndefined();
  });

  it('Should only modify AIRDROP_MINTED_TOKEN type', async () => {
    const order = {
      uid: getRandomEthAddress(),
      payload: {
        type: TransactionOrderType.BUY_TOKEN,
        drops: [{ count: 100 }, { count: 20 }, { count: 3 }],
      },
    };
    await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
    await migrateAirdropOrders(admin.app());

    const data = <Transaction>(
      (await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).get()).data()
    );
    expect(data.payload.totalAirdropCount).toBeUndefined();
    expect(data.payload.unclaimedAirdrops).toBeUndefined();
    expect(data.payload.drops).toEqual(order.payload.drops);
  });
});
