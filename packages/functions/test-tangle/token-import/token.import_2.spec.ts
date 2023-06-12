import { COL, MIN_IOTA_AMOUNT, Transaction } from '@build5/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { importMintedToken } from '../../src/runtime/firebase/token/minting';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Token import', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should throw, not guardian ', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, {
      space: helper.importSpace.uid,
      tokenId: helper.token.mintingData?.tokenId,
      network: helper.network,
    });
    const order = await testEnv.wrap(importMintedToken)({});
    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, 2 * MIN_IOTA_AMOUNT);

    const creditQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian.uid)
      .where('payload.response.code', '==', 2122);
    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    const migratedTokenDocRef = soonDb().doc(`${COL.TOKEN}/${helper.token.mintingData?.tokenId}`);
    expect((await migratedTokenDocRef.get()) !== undefined).toBe(false);
  });
});
