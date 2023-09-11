import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  NetworkAddress,
  Space,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { enableTokenTrading } from '../../src/runtime/firebase/token/base';
import { cancelTradeOrder, tradeToken } from '../../src/runtime/firebase/token/trading';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import {
  createMember,
  createSpace,
  expectThrow,
  getRandomSymbol,
  mockIpCheck,
  mockWalletReturnValue,
  wait,
} from './common';

let walletSpy: any;

describe('Trade controller, sell token', () => {
  let memberAddress: NetworkAddress;
  let token: Token;
  let space: Space;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy);
    space = await createSpace(walletSpy, memberAddress);

    const tokenId = wallet.getRandomEthAddress();
    token = <Token>{
      uid: tokenId,
      symbol: getRandomSymbol(),
      name: 'MyToken',
      status: TokenStatus.AVAILABLE,
      approved: true,
      space: space.uid,
    };
    await build5Db().doc(`${COL.TOKEN}/${tokenId}`).set(token);
    const distribution = <TokenDistribution>{ tokenOwned: 10 };
    await build5Db()
      .doc(`${COL.TOKEN}/${tokenId}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
      .set(distribution);
  });

  it('Should create sell order and cancel it', async () => {
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    const sell = <TokenTradeOrder>await testEnv.wrap(tradeToken)({});
    expect(sell.count).toBe(5);
    expect(sell.price).toBe(MIN_IOTA_AMOUNT);
    expect(sell.tokenStatus).toBe(TokenStatus.AVAILABLE);

    const distribution = await build5Db()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
      .get<TokenDistribution>();
    expect(distribution?.lockedForSale).toBe(5);

    await wait(async () => {
      const doc = <TokenTradeOrder>await build5Db().doc(`${COL.TOKEN_MARKET}/${sell.uid}`).get();
      return (
        doc.updatedOn !== undefined &&
        dayjs(doc.updatedOn.toDate()).isAfter(doc.createdOn!.toDate())
      );
    });

    const cancelRequest = { uid: sell.uid };
    mockWalletReturnValue(walletSpy, memberAddress, cancelRequest);
    const cancelled = await testEnv.wrap(cancelTradeOrder)({});
    expect(cancelled.status).toBe(TokenTradeOrderStatus.CANCELLED);

    const cancelledDistribution = await build5Db()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
      .get<TokenDistribution>();
    expect(cancelledDistribution?.lockedForSale).toBe(0);
  });

  it('Should throw, not enough tokens', async () => {
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 11,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.no_available_tokens_for_sale.key);
  });

  it('Should create, total price too low', async () => {
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2,
      count: 1,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    const sellOrder = await testEnv.wrap(tradeToken)({});
    expect(sellOrder.price).toBe(MIN_IOTA_AMOUNT / 2);
  });

  it('Should throw on one, not enough tokens', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 8,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});
    mockWalletReturnValue(walletSpy, memberAddress, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 8,
      type: TokenTradeOrderType.SELL,
    });
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.no_available_tokens_for_sale.key);
  });

  it('Should throw, not enough tokens even after cancels', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.SELL,
    });
    const sell = await testEnv.wrap(tradeToken)({});
    mockWalletReturnValue(walletSpy, memberAddress, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT as any,
      count: 5,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});

    mockWalletReturnValue(walletSpy, memberAddress, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 8,
      type: TokenTradeOrderType.SELL,
    });
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.no_available_tokens_for_sale.key);

    const cancelRequest = { uid: sell.uid };
    mockWalletReturnValue(walletSpy, memberAddress, cancelRequest);
    await testEnv.wrap(cancelTradeOrder)({});

    const distribution = await build5Db()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
      .get<TokenDistribution>();
    expect(distribution?.lockedForSale).toBe(5);

    mockWalletReturnValue(walletSpy, memberAddress, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 8,
      type: TokenTradeOrderType.SELL,
    });
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.no_available_tokens_for_sale.key);
  });

  it('Should update sale lock properly', async () => {
    const distDocRef = build5Db().doc(
      `${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`,
    );
    const count = 3;
    const sells = [] as any[];
    for (let i = 0; i < count; ++i) {
      mockWalletReturnValue(walletSpy, memberAddress, {
        symbol: token.symbol,
        price: MIN_IOTA_AMOUNT,
        count: 1,
        type: TokenTradeOrderType.SELL,
      });
      sells.push(await testEnv.wrap(tradeToken)({}));
    }
    await wait(async () => {
      const distribution = await distDocRef.get<TokenDistribution>();
      return distribution?.lockedForSale === count;
    });

    for (let i = 0; i < count; ++i) {
      const cancelRequest = { uid: sells[i].uid };
      mockWalletReturnValue(walletSpy, memberAddress, cancelRequest);
      await testEnv.wrap(cancelTradeOrder)({});
      const distribution = await distDocRef.get<TokenDistribution>();
      expect(distribution?.lockedForSale).toBe(count - i - 1);
    }
  });

  it('Should throw, token not approved', async () => {
    await build5Db().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false });
    mockWalletReturnValue(walletSpy, memberAddress, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 8,
      type: TokenTradeOrderType.SELL,
    });
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.token_does_not_exist.key);
  });

  it('Should throw, precision too much', async () => {
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT + 0.123,
      count: 5,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    const sell = <TokenTradeOrder>await testEnv.wrap(tradeToken)({});
    expect(sell.count).toBe(5);

    const request2 = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT + 0.1234567,
      count: 5,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request2);
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.invalid_params.key);
  });

  it('Should fail, country blocked by default', async () => {
    mockIpCheck(true, { common: ['HU'] }, { countryCode: 'HU' });
    const request = {
      symbol: token.symbol,
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
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.blocked_country.key);
  });

  it('Should fail first, tading disabled, then succeeed', async () => {
    await build5Db()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ tradingDisabled: true, public: true });
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.token_trading_disabled.key);

    mockWalletReturnValue(walletSpy, memberAddress, { uid: token.uid });
    await testEnv.wrap(enableTokenTrading)({});

    mockWalletReturnValue(walletSpy, memberAddress, request);
    const sell = <TokenTradeOrder>await testEnv.wrap(tradeToken)({});
    expect(sell.count).toBe(5);
    expect(sell.price).toBe(MIN_IOTA_AMOUNT);
    expect(sell.tokenStatus).toBe(TokenStatus.AVAILABLE);
  });
});
