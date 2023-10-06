/* eslint-disable @typescript-eslint/no-explicit-any */

import { COL, SUB_COL, Token, TokenDistribution, WenError } from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { claimMintedTokenOrder } from '../../src/runtime/firebase/token/minting';
import { expectThrow, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach(VAULT_MNEMONIC, MINTED_TOKEN_ID);
  });

  it('Should throw, nothing to claim, can not create order', async () => {
    await build5Db()
      .doc(`${COL.TOKEN}/${helper.token.uid}/${SUB_COL.DISTRIBUTION}/${helper.guardian.uid}`)
      .set({ tokenOwned: 1 });
    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, { symbol: helper.token.symbol });
    const order = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    await wait(async () => {
      const distributionDocRef = build5Db().doc(
        `${COL.TOKEN}/${helper.token.uid}/${SUB_COL.DISTRIBUTION}/${helper.guardian.uid}`,
      );
      const distribution = <TokenDistribution>await distributionDocRef.get();
      return distribution.mintedClaimedOn !== undefined;
    });

    await expectThrow(testEnv.wrap(claimMintedTokenOrder)({}), WenError.no_tokens_to_claim.key);

    const tokenData = <Token>await build5Db().doc(`${COL.TOKEN}/${helper.token.uid}`).get();
    expect(tokenData.mintingData?.tokensInVault).toBe(9);

    await awaitTransactionConfirmationsForToken(helper.token.uid);
  });
});

const VAULT_MNEMONIC =
  'you right side purity bracket orphan control strong affair east pet bean future file spy wet witness flat garden flavor mechanic path load amused';
const MINTED_TOKEN_ID =
  '0x08a0dfb75950fc14feb84f6152aa41d518959831f8f4253ec355ee1dab5747f37e0100000000';
