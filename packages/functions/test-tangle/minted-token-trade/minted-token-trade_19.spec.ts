import { COL, MIN_IOTA_AMOUNT, Network, TangleRequestType, Transaction } from '@build-5/interfaces';

import { build5Db } from '@build-5/database';
import { wait } from '../../test/controls/common';
import { awaitTransactionConfirmationsForToken, getTangleOrder } from '../common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import { Helper, VAULT_MNEMONIC } from './Helper';

describe('Minted toke trading tangle request', () => {
  const helper = new Helper();
  let tangleOrder: Transaction;

  beforeAll(async () => {
    await helper.berforeAll();
    tangleOrder = await getTangleOrder(Network.RMS);
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should create purchase, custom target address', async () => {
    const faucetPromises = [
      requestFundsFromFaucet(Network.RMS, helper.sellerAddress!.bech32, MIN_IOTA_AMOUNT),
      requestFundsFromFaucet(Network.RMS, helper.buyerAddress!.bech32, 5 * MIN_IOTA_AMOUNT),
      requestMintedTokenFromFaucet(
        helper.walletService!,
        helper.sellerAddress!,
        helper.token!.mintingData?.tokenId!,
        VAULT_MNEMONIC,
      ),
    ];
    await Promise.all(faucetPromises);

    const sellerTargetAddress = await helper.walletService!.getNewIotaAddressDetails();
    helper.walletService!.send(
      helper.sellerAddress!,
      tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.SELL_TOKEN,
            symbol: helper.token!.symbol,
            price: MIN_IOTA_AMOUNT,
            targetAddress: sellerTargetAddress.bech32,
          },
        },
        nativeTokens: [{ id: helper.token?.mintingData?.tokenId!, amount: BigInt(5) }],
      },
    );

    const buyerTargetAddress = await helper.walletService!.getNewIotaAddressDetails();
    helper.walletService!.send(
      helper.buyerAddress!,
      tangleOrder.payload.targetAddress!,
      5 * MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.BUY_TOKEN,
            symbol: helper.token!.symbol,
            count: 5,
            price: MIN_IOTA_AMOUNT,
            targetAddress: buyerTargetAddress.bech32,
          },
        },
      },
    );

    const queryBySeller = build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.seller);
    await wait(async () => {
      const snap = await queryBySeller.get();
      return snap.length > 0;
    });
    const sell = (await queryBySeller.get())[0]!;

    const queryByOwner = build5Db().collection(COL.TOKEN_MARKET).where('owner', '==', helper.buyer);
    await wait(async () => {
      const snap = await queryByOwner.get();
      return snap.length > 0;
    });
    const buy = (await queryByOwner.get())[0]!;

    const queryByTrade = build5Db()
      .collection(COL.TOKEN_PURCHASE)
      .where('sell', '==', sell.uid)
      .where('buy', '==', buy.uid);
    await wait(async () => {
      const snap = await queryByTrade.get();
      return snap.length > 0;
    });

    await awaitTransactionConfirmationsForToken(helper.token?.uid!);

    const balance = await helper.walletService!.getBalance(buyerTargetAddress.bech32);
    expect(balance.nativeTokens[helper.token?.mintingData?.tokenId!]).toBe(5);

    const { amount: sellerAmount } = await helper.walletService!.getBalance(
      sellerTargetAddress.bech32,
    );
    expect(sellerAmount).toBe(4727600);
  });
});
