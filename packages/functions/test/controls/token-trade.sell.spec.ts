import {
  COL,
  MIN_IOTA_AMOUNT,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  WenError,
} from '@soon/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { cancelTradeOrder } from '../../src/controls/token-trading/token-trade-cancel.controller';
import { tradeToken } from '../../src/controls/token-trading/token-trade.controller';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import {
  createMember,
  expectThrow,
  getRandomSymbol,
  mockIpCheck,
  mockWalletReturnValue,
  wait,
} from './common';

let walletSpy: any;

describe('Trade controller, sell token', () => {
  let memberAddress: string;
  let token: Token;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy);

    const tokenId = wallet.getRandomEthAddress();
    token = <Token>{
      uid: tokenId,
      symbol: getRandomSymbol(),
      name: 'MyToken',
      status: TokenStatus.AVAILABLE,
      approved: true,
    };
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).set(token);
    const distribution = <TokenDistribution>{ tokenOwned: 10 };
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${tokenId}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
      .set(distribution);
  });

  it('Should create sell order and cancel it', async () => {
    const request = {
      token: token.uid,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    const sell = <TokenTradeOrder>await testEnv.wrap(tradeToken)({});
    expect(sell.count).toBe(5);
    expect(sell.price).toBe(MIN_IOTA_AMOUNT);
    expect(sell.tokenStatus).toBe(TokenStatus.AVAILABLE);

    const distribution = await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
      .get();
    expect(distribution.data()?.lockedForSale).toBe(5);

    await wait(async () => {
      const doc = <TokenTradeOrder>(
        (await admin.firestore().doc(`${COL.TOKEN_MARKET}/${sell.uid}`).get()).data()
      );
      return (
        doc.updatedOn !== undefined &&
        dayjs(doc.updatedOn.toDate()).isAfter(doc.createdOn!.toDate())
      );
    });

    const cancelRequest = { uid: sell.uid };
    mockWalletReturnValue(walletSpy, memberAddress, cancelRequest);
    const cancelled = await testEnv.wrap(cancelTradeOrder)({});
    expect(cancelled.status).toBe(TokenTradeOrderStatus.CANCELLED);

    const cancelledDistribution = await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
      .get();
    expect(cancelledDistribution.data()?.lockedForSale).toBe(0);
  });

  it('Should throw, not enough tokens', async () => {
    const request = {
      token: token.uid,
      price: MIN_IOTA_AMOUNT,
      count: 11,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    expectThrow(testEnv.wrap(tradeToken)({}), WenError.no_available_tokens_for_sale.key);
  });

  it('Should throw, total price too low', async () => {
    const request = {
      token: token.uid,
      price: MIN_IOTA_AMOUNT / 2,
      count: 1,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    expectThrow(testEnv.wrap(tradeToken)({}), WenError.invalid_params.key);
  });

  it('Should throw on one, not enough tokens', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      token: token.uid,
      price: MIN_IOTA_AMOUNT,
      count: 8,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});
    mockWalletReturnValue(walletSpy, memberAddress, {
      token: token.uid,
      price: MIN_IOTA_AMOUNT,
      count: 8,
      type: TokenTradeOrderType.SELL,
    });
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.no_available_tokens_for_sale.key);
  });

  it('Should throw, not enough tokens even after cancels', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      token: token.uid,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.SELL,
    });
    const sell = await testEnv.wrap(tradeToken)({});
    mockWalletReturnValue(walletSpy, memberAddress, {
      token: token.uid,
      price: MIN_IOTA_AMOUNT as any,
      count: 5,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});

    mockWalletReturnValue(walletSpy, memberAddress, {
      token: token.uid,
      price: MIN_IOTA_AMOUNT,
      count: 8,
      type: TokenTradeOrderType.SELL,
    });
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.no_available_tokens_for_sale.key);

    const cancelRequest = { uid: sell.uid };
    mockWalletReturnValue(walletSpy, memberAddress, cancelRequest);
    await testEnv.wrap(cancelTradeOrder)({});

    const distribution = await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
      .get();
    expect(distribution.data()?.lockedForSale).toBe(5);

    mockWalletReturnValue(walletSpy, memberAddress, {
      token: token.uid,
      price: MIN_IOTA_AMOUNT,
      count: 8,
      type: TokenTradeOrderType.SELL,
    });
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.no_available_tokens_for_sale.key);
  });

  it('Should update sale lock properly', async () => {
    const distDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`);
    const count = 3;
    const sells = [] as any[];
    for (let i = 0; i < count; ++i) {
      mockWalletReturnValue(walletSpy, memberAddress, {
        token: token.uid,
        price: MIN_IOTA_AMOUNT,
        count: 1,
        type: TokenTradeOrderType.SELL,
      });
      sells.push(await testEnv.wrap(tradeToken)({}));
    }
    await wait(async () => {
      const distribution = await distDocRef.get();
      return distribution.data()?.lockedForSale === count;
    });

    for (let i = 0; i < count; ++i) {
      const cancelRequest = { uid: sells[i].uid };
      mockWalletReturnValue(walletSpy, memberAddress, cancelRequest);
      await testEnv.wrap(cancelTradeOrder)({});
      const distribution = await distDocRef.get();
      expect(distribution.data()?.lockedForSale).toBe(count - i - 1);
    }
  });

  it('Should throw, token not approved', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false });
    mockWalletReturnValue(walletSpy, memberAddress, {
      token: token.uid,
      price: MIN_IOTA_AMOUNT,
      count: 8,
      type: TokenTradeOrderType.SELL,
    });
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.token_not_approved.key);
  });

  it('Should throw, precision too much', async () => {
    const request = {
      token: token.uid,
      price: MIN_IOTA_AMOUNT + 0.123,
      count: 5,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    const sell = <TokenTradeOrder>await testEnv.wrap(tradeToken)({});
    expect(sell.count).toBe(5);

    const request2 = {
      token: token.uid,
      price: MIN_IOTA_AMOUNT + 0.1234,
      count: 5,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request2);
    expectThrow(testEnv.wrap(tradeToken)({}), WenError.invalid_params.key);
  });

  it('Should fail, country blocked by default', async () => {
    mockIpCheck(true, { common: ['HU'] }, { countryCode: 'HU' });
    const request = {
      token: token.uid,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.blocked_country.key);
  });

  it('Should fail, country blocked for token', async () => {
    mockIpCheck(true, { common: ['USA'], [token.uid]: ['USA', 'HU'] }, { countryCode: 'HU' });
    const request = {
      token: token.uid,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.blocked_country.key);
  });
});
