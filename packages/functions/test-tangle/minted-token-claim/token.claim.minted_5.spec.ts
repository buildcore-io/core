/* eslint-disable @typescript-eslint/no-explicit-any */

import { build5Db } from '@build-5/database';
import { COL, SUB_COL, Token, TokenDistribution, TransactionType } from '@build-5/interfaces';
import { claimMintedTokenOrder } from '../../src/runtime/firebase/token/minting';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach(VAULT_MNEMONIC, MINTED_TOKEN_ID);
  });

  it('Should credit second claim', async () => {
    await build5Db()
      .doc(`${COL.TOKEN}/${helper.token.uid}/${SUB_COL.DISTRIBUTION}/${helper.guardian.uid}`)
      .set({ tokenOwned: 1 });
    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, { symbol: helper.token.symbol });
    const order = await testEnv.wrap(claimMintedTokenOrder)({});
    const order2 = await testEnv.wrap(claimMintedTokenOrder)({});

    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);
    await requestFundsFromFaucet(
      helper.network,
      order2.payload.targetAddress,
      order2.payload.amount,
    );

    await wait(async () => {
      const distributionDocRef = build5Db().doc(
        `${COL.TOKEN}/${helper.token.uid}/${SUB_COL.DISTRIBUTION}/${helper.guardian.uid}`,
      );
      const distribution = <TokenDistribution>await distributionDocRef.get();
      return distribution?.mintedClaimedOn !== undefined;
    });

    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian.uid)
      .where('type', '==', TransactionType.CREDIT);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });

    const tokenData = <Token>await build5Db().doc(`${COL.TOKEN}/${helper.token.uid}`).get();
    expect(tokenData.mintingData?.tokensInVault).toBe(9);
  });
});

export const VAULT_MNEMONIC =
  'wreck detail wheat pony leg rib grit width clog nominee giggle behave beef boy help maple robot avocado orphan spider exist hair fury tomato';
export const MINTED_TOKEN_ID =
  '0x08e855e4178b569d03e6866aebda32ac8de6926a98d286bdd35ff72cdffbcc92a80100000000';
