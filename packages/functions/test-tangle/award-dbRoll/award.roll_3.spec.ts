import { HexHelper } from '@iota/util.js-next';
import { COL, MIN_IOTA_AMOUNT, Network, Transaction } from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import { set } from 'lodash';
import admin from '../../src/admin.config';
import { awardRoll } from '../../src/firebase/functions/dbRoll/award.roll';
import { wait } from '../../test/controls/common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import { createdBy, Helper, MINTED_TOKEN_ID, newAward, VAULT_MNEMONIC } from './Helper';

describe('Award roll test', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.clearDb();
    await helper.beforeEach();
  });

  it('Should fund many award', async () => {
    const count = 65;
    const batch = admin.firestore().batch();
    Array.from(Array(count)).forEach(() => {
      const legacyAward = newAward(helper.space.uid);
      set(legacyAward, 'badge.image', null);
      const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${legacyAward.uid}`);
      batch.create(awardDocRef, legacyAward);
    });
    await batch.commit();

    let order: Transaction = {} as any;
    const req = { body: {} } as any;
    const res = {
      send: (response: Transaction) => {
        order = response;
      },
    } as any;
    await awardRoll(req, res);

    expect(MINTED_TOKEN_ID).toBe(order.payload.nativeTokens[0].id);
    await requestFundsFromFaucet(
      Network.RMS,
      helper.guardianAddress.bech32,
      order.payload.amount + 10 * MIN_IOTA_AMOUNT,
    );

    await requestMintedTokenFromFaucet(
      helper.wallet,
      helper.guardianAddress,
      MINTED_TOKEN_ID,
      VAULT_MNEMONIC,
      order.payload.nativeTokens[0].amount,
    );

    await helper.wallet.send(
      helper.guardianAddress,
      order.payload.targetAddress,
      order.payload.amount,
      {
        nativeTokens: [
          {
            id: order.payload.nativeTokens[0].id,
            amount: HexHelper.fromBigInt256(bigInt(order.payload.nativeTokens[0].amount)),
          },
        ],
      },
    );

    const orderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`);
    await wait(async () => {
      order = (await orderDocRef.get()).data() as Transaction;
      return order.payload.legacyAwardsBeeingFunded === 63;
    });

    await wait(async () => {
      order = (await orderDocRef.get()).data() as Transaction;
      return order.payload.legacyAwardsBeeingFunded === 2;
    });

    await wait(async () => {
      order = (await orderDocRef.get()).data() as Transaction;
      return order.payload.legacyAwardsBeeingFunded === 0;
    });

    const awardsQuery = admin.firestore().collection(COL.AWARD).where('createdBy', '==', createdBy);
    await wait(async () => {
      const snap = await awardsQuery.get();
      return snap.docs.reduce((acc, act) => acc && act.data()?.funded, true);
    });
  });
});
