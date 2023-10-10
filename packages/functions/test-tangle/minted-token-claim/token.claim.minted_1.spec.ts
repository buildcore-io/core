/* eslint-disable @typescript-eslint/no-explicit-any */

import { COL, SUB_COL, Token, Transaction, TransactionType } from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { claimMintedTokenOrder } from '../../src/runtime/firebase/token/minting';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach(VAULT_MNEMONIC, MINTED_TOKEN_ID);
  });

  it('Claim minted tokens by guardian', async () => {
    await build5Db()
      .doc(`${COL.TOKEN}/${helper.token.uid}/${SUB_COL.DISTRIBUTION}/${helper.guardian.uid}`)
      .set({ tokenOwned: 1 });

    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, { symbol: helper.token.symbol });
    const order = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', helper.guardian.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });
    const billPayment = (await query.get())[0] as Transaction;
    expect(billPayment.payload.amount).toBe(order.payload.amount);
    expect(billPayment.payload.nativeTokens![0].amount).toBe(1);

    const tokenData = <Token>await build5Db().doc(`${COL.TOKEN}/${helper.token.uid}`).get();
    expect(tokenData.mintingData?.tokensInVault).toBe(9);

    await awaitTransactionConfirmationsForToken(helper.token.uid);
  });
});

const VAULT_MNEMONIC =
  'suit buyer board limit suspect cycle month promote wolf company smile salt banner arrest burden raccoon chat ridge novel gallery diary roast coach visual';
const MINTED_TOKEN_ID =
  '0x084880278c0a02f22f3fe388edd51a340be1c22e31a572307e44296d639bf359d80100000000';
