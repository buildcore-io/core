/* eslint-disable @typescript-eslint/no-explicit-any */

import { COL, Member, SUB_COL, Token, TokenStatus, TransactionType } from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { claimMintedTokenOrder, mintTokenOrder } from '../../src/runtime/firebase/token/minting';
import { createMember, createSpace, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach(VAULT_MNEMONIC, MINTED_TOKEN_ID);
  });

  it('Should return deposit after claiming all', async () => {
    const minterId = await createMember(helper.walletSpy);
    const minter = <Member>await build5Db().doc(`${COL.MEMBER}/${minterId}`).get();
    helper.space = await createSpace(helper.walletSpy, minter.uid);
    helper.token = await helper.saveToken(
      helper.space.uid,
      minter.uid,
      VAULT_MNEMONIC,
      MINTED_TOKEN_ID,
      true,
    );
    await build5Db()
      .doc(`${COL.TOKEN}/${helper.token.uid}/${SUB_COL.DISTRIBUTION}/${helper.guardian.uid}`)
      .set({ tokenOwned: 1 });

    mockWalletReturnValue(helper.walletSpy, minter.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    const order = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${helper.token.uid}`);
    await wait(async () => {
      const snap = await tokenDocRef.get<Token>();
      return snap?.status === TokenStatus.MINTED;
    });

    helper.token = await tokenDocRef.get();
    await wait(async () => {
      const { nativeTokens } = await helper.wallet.getBalance(
        helper.token.mintingData?.vaultAddress,
      );
      return Number(Object.values(nativeTokens)[0]) === 1;
    });

    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, { symbol: helper.token.symbol });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      helper.network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );

    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', helper.guardian.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });

    const creditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', minter.uid);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.length === 1;
    });

    await awaitTransactionConfirmationsForToken(helper.token.uid);
  });
});

export const VAULT_MNEMONIC =
  'impose liar slush abandon mean diary neglect rocket gown coast promote leaf artist animal fall gadget tree oak explain guard topic hair rose marble';
export const MINTED_TOKEN_ID =
  '0x0896a499f3b8d416197b633a01c45a2bcea60ca82c36f0c571466787612fe983860100000000';
