import { HexHelper } from '@iota/util.js-next';
import { Award, COL, MIN_IOTA_AMOUNT, Network, Transaction } from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import admin from '../../src/admin.config';
import { awardRoll } from '../../src/firebase/functions/dbRoll/award.roll';
import { wait } from '../../test/controls/common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import {
  createdBy,
  fullyCompletedAward,
  halfCompletedAward,
  Helper,
  MINTED_TOKEN_ID,
  newAward,
  VAULT_MNEMONIC,
} from './Helper';

describe('Award roll test', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.clearDb();
    await helper.beforeEach();
  });

  const createAndSaveAward = async (func: (space: string) => any) => {
    const legacyAward = func(helper.space.uid);
    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${legacyAward.uid}`);
    await awardDocRef.create(legacyAward);
    return legacyAward;
  };

  it('Should fund awards', async () => {
    await createAndSaveAward(newAward);
    await createAndSaveAward(halfCompletedAward);
    await createAndSaveAward(fullyCompletedAward);

    let order: Transaction = {} as any;
    const req = { body: {} } as any;
    const res = {
      send: (response: Transaction) => {
        order = response;
      },
    } as any;
    await awardRoll(req, res);

    expect(MINTED_TOKEN_ID).toBe(order.payload.nativeTokens[0].id);
    await requestFundsFromFaucet(Network.RMS, helper.guardianAddress.bech32, 10 * MIN_IOTA_AMOUNT);

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
      return order.payload.legacyAwardsBeeingFunded === 3;
    });
    await wait(async () => {
      order = (await orderDocRef.get()).data() as Transaction;
      return order.payload.legacyAwardsBeeingFunded === 0;
    });

    const awardsQuery = admin.firestore().collection(COL.AWARD).where('createdBy', '==', createdBy);
    await wait(async () => {
      const snap = await awardsQuery.get();
      return snap.docs.reduce((acc, act) => acc && act.data()?.approved, true);
    });

    const awardsSnap = await awardsQuery.get();
    for (const doc of awardsSnap.docs) {
      const award = doc.data() as Award;
      expect(award.approved).toBe(true);
      expect(award.aliasId).toBeDefined();
      expect(award.collectionId).toBeDefined();
    }
  });
});
