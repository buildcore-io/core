/* eslint-disable @typescript-eslint/no-explicit-any */

import { build5Db } from '@build-5/database';
import { COL, MIN_IOTA_AMOUNT, TokenPurchase, TokenTradeOrder } from '@build-5/interfaces';
import { wait } from '../../test/controls/common';
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

  it('Should fulfill low price sell with high price buy', async () => {
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      helper.sellerAddress!,
      helper.token!.mintingData?.tokenId!,
      VAULT_MNEMONIC,
      80,
    );

    await helper.createSellTradeOrder(100, MIN_IOTA_AMOUNT / 100);
    const buyOrder = await helper.createBuyOrder(99, MIN_IOTA_AMOUNT);

    const buyQuery = build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('orderTransactionId', '==', buyOrder.uid);
    await wait(async () => {
      const buySnap = await buyQuery.get();
      return buySnap[0].fulfilled === 99;
    });
    let buy = (await buyQuery.get())[0] as TokenTradeOrder;
    let purchase = (
      await build5Db().collection(COL.TOKEN_PURCHASE).where('buy', '==', buy.uid).get()
    )[0] as TokenPurchase;
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT / 100);

    const buyOrder2 = await helper.createBuyOrder(1, MIN_IOTA_AMOUNT);
    const buyQuery2 = build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('orderTransactionId', '==', buyOrder2.uid);
    await wait(async () => {
      const buySnap = await buyQuery2.get();
      return buySnap[0].fulfilled === 1;
    });

    buy = (await buyQuery2.get())[0] as TokenTradeOrder;
    purchase = (
      await build5Db().collection(COL.TOKEN_PURCHASE).where('buy', '==', buy.uid).get()
    )[0] as TokenPurchase;
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
