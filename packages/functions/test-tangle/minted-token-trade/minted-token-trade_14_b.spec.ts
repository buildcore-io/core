/* eslint-disable @typescript-eslint/no-explicit-any */

import { database } from '@buildcore/database';
import { COL, MIN_IOTA_AMOUNT } from '@buildcore/interfaces';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestMintedTokenFromFaucet } from '../faucet';
import { Helper, VAULT_MNEMONIC } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.berforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should not fill buy, balance would be less then MIN_IOTA_AMOUNT and order not fulfilled', async () => {
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      helper.sellerAddress!,
      helper.token!.mintingData?.tokenId!,
      VAULT_MNEMONIC,
      180,
    );

    await helper.createSellTradeOrder(199, MIN_IOTA_AMOUNT / 100);
    await helper.createBuyOrder(200, MIN_IOTA_AMOUNT / 100);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const purchase = await database()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', helper.token!.uid)
      .get();
    expect(purchase.length).toBe(0);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
