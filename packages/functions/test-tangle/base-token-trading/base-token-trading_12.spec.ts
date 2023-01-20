import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  TangleRequestType,
  TokenTradeOrder,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { wait } from '../../test/controls/common';
import { getRmsSoonTangleResponse, getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Base token trading', () => {
  const helper = new Helper();
  let tangleOrder: Transaction;

  beforeEach(async () => {
    await helper.beforeEach();
    tangleOrder = await getTangleOrder();
  });

  it('Should create sell order with tangle', async () => {
    const atoiAddress = helper.sellerValidateAddress[Network.ATOI];
    const rmsAddress = helper.sellerValidateAddress[Network.RMS];
    await requestFundsFromFaucet(helper.sourceNetwork, atoiAddress.bech32, 5 * MIN_IOTA_AMOUNT);
    await requestFundsFromFaucet(helper.targetNetwork, rmsAddress.bech32, 5 * MIN_IOTA_AMOUNT);

    await helper.rmsWallet!.send(rmsAddress, tangleOrder.payload.targetAddress, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.SELL_TOKEN,
          symbol: helper.token?.symbol!,
          count: MIN_IOTA_AMOUNT,
          price: 1.5,
        },
      },
    });

    let query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.seller!.uid)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await query.get();
      return snap.docs[0]?.data()?.payload?.walletReference?.confirmed;
    });

    let snap = await query.get();
    const response = await getRmsSoonTangleResponse(snap.docs[0], helper.rmsWallet!);

    await helper.atoiWallet!.send(atoiAddress, response.address, response.amount, {});
    query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', helper.seller!.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.size > 0;
    });
    snap = await query.get();
    const sellOrder = <TokenTradeOrder>snap.docs[0].data();
    expect(sellOrder.owner).toBe(helper.seller!.uid);
    expect(sellOrder.price).toBe(1.5);
    expect(sellOrder.count).toBe(MIN_IOTA_AMOUNT);
    expect(sellOrder.type).toBe(TokenTradeOrderType.SELL);
  });

  it('Should buy base token with tangle request', async () => {
    const rmsAddress = helper.buyerValidateAddress[Network.RMS];
    await requestFundsFromFaucet(helper.targetNetwork, rmsAddress.bech32, 5 * MIN_IOTA_AMOUNT);

    await helper.rmsWallet!.send(
      rmsAddress,
      tangleOrder.payload.targetAddress,
      1.5 * MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.BUY_TOKEN,
            symbol: helper.token?.symbol!,
            count: MIN_IOTA_AMOUNT,
            price: 1.5,
          },
        },
      },
    );

    const query = admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.buyer!.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.size > 0;
    });
    const snap = await query.get();
    const sellOrder = <TokenTradeOrder>snap.docs[0].data();
    expect(sellOrder.owner).toBe(helper.buyer!.uid);
    expect(sellOrder.price).toBe(1.5);
    expect(sellOrder.count).toBe(MIN_IOTA_AMOUNT);
    expect(sellOrder.type).toBe(TokenTradeOrderType.BUY);
  });
});
