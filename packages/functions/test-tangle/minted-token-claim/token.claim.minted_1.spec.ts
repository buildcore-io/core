/* eslint-disable @typescript-eslint/no-explicit-any */

import { build5Db } from '@build-5/database';
import { COL, SUB_COL, Token, Transaction, TransactionType, WEN_FUNC } from '@build-5/interfaces';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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
      .doc(COL.TOKEN, helper.token.uid, SUB_COL.DISTRIBUTION, helper.guardian.uid)
      .upsert({ tokenOwned: 1 });

    mockWalletReturnValue(helper.guardian.uid, { symbol: helper.token.symbol });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.claimMintedTokenOrder);
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

    const tokenData = <Token>await build5Db().doc(COL.TOKEN, helper.token.uid).get();
    expect(tokenData.mintingData?.tokensInVault).toBe(9);

    await awaitTransactionConfirmationsForToken(helper.token.uid);
  });
});

export const VAULT_MNEMONIC =
  'egg festival about walnut drama exclude thrive chest edge hollow miss civil turkey april toast survey already mail sign fire exile rack kidney wagon';
export const MINTED_TOKEN_ID =
  '0x0844694a6b67ba375246148afd9cca94d7a3d06e91d77c51f2cc4e68dcb69508ba0100000000';
