import { build5Db } from '@build-5/database';
import { COL, MIN_IOTA_AMOUNT, Network, TangleRequestType, Transaction } from '@build-5/interfaces';
import { wait } from '../../test/controls/common';
import { awaitTransactionConfirmationsForToken, getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Base token trading', () => {
  const helper = new Helper();
  let atoiTangleOrder: Transaction;
  let rmsTangleOrder: Transaction;

  beforeEach(async () => {
    await helper.beforeEach();
    atoiTangleOrder = await getTangleOrder(Network.ATOI);
    rmsTangleOrder = await getTangleOrder(Network.RMS);
  });

  it('Should trade, custom target address', async () => {
    const atoiAddress = helper.sellerValidateAddress[Network.ATOI];
    const rmsAddress = helper.buyerValidateAddress[Network.RMS];

    const faucetPromises = [
      requestFundsFromFaucet(helper.sourceNetwork, atoiAddress.bech32, MIN_IOTA_AMOUNT),
      requestFundsFromFaucet(helper.targetNetwork, rmsAddress.bech32, MIN_IOTA_AMOUNT),
    ];
    await Promise.all(faucetPromises);

    const sellerTargetAddress = await helper.rmsWallet!.getNewIotaAddressDetails();
    await helper.rmsWallet!.send(
      atoiAddress,
      atoiTangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.SELL_TOKEN,
            symbol: helper.token?.symbol!,
            count: MIN_IOTA_AMOUNT,
            price: 1,
            targetAddress: sellerTargetAddress.bech32,
          },
        },
      },
    );

    const buyerTargetAddress = await helper.atoiWallet!.getNewIotaAddressDetails();
    helper.rmsWallet!.send(rmsAddress, rmsTangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.BUY_TOKEN,
          symbol: helper.token?.symbol!,
          count: MIN_IOTA_AMOUNT,
          price: 1,
          targetAddress: buyerTargetAddress.bech32,
        },
      },
    });

    const queryBySeller = build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.seller!.uid);
    await wait(async () => {
      const snap = await queryBySeller.get();
      return snap.length > 0;
    });
    const sell = (await queryBySeller.get())[0]!;

    const queryByBuyer = build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.buyer!.uid);
    await wait(async () => {
      const snap = await queryByBuyer.get();
      return snap.length > 0;
    });
    const buy = (await queryByBuyer.get())[0]!;

    const query = build5Db()
      .collection(COL.TOKEN_PURCHASE)
      .where('sell', '==', sell.uid)
      .where('buy', '==', buy.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length > 0;
    });

    await awaitTransactionConfirmationsForToken(helper.token?.uid!);

    const { amount: buyerAmount } = await helper.atoiWallet!.getBalance(buyerTargetAddress.bech32);
    expect(buyerAmount).toBe(MIN_IOTA_AMOUNT);

    const { amount: sellerAmount } = await helper.rmsWallet!.getBalance(sellerTargetAddress.bech32);
    expect(sellerAmount).toBe(881400);
  });
});
