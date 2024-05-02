import { database } from '@buildcore/database';
import { COL, MIN_IOTA_AMOUNT, Transaction, WEN_FUNC } from '@buildcore/interfaces';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Token import', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should throw, not guardian ', async () => {
    mockWalletReturnValue(helper.guardian.uid, {
      space: helper.importSpace.uid,
      tokenId: helper.token.mintingData?.tokenId,
      network: helper.network,
    });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.importMintedToken);
    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, 2 * MIN_IOTA_AMOUNT);

    const creditQuery = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian.uid);
    await wait(async () => {
      const snap = (await creditQuery.get()).filter((s) => s.payload.response?.code === 2122);
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    const migratedTokenDocRef = database().doc(COL.TOKEN, helper.token.mintingData?.tokenId!);
    expect((await migratedTokenDocRef.get()) !== undefined).toBe(false);
  });
});
