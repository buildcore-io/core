import { COL, MIN_IOTA_AMOUNT } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
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

    const creditQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian.uid)
      .where('payload.response.code', '==', 2122);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });
    const migratedTokenDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token.mintingData?.tokenId}`);
    expect((await migratedTokenDocRef.get()).exists).toBe(false);
  });
});
