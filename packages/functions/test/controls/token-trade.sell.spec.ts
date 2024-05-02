import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  NetworkAddress,
  SOON_PROJECT_ID,
  Space,
  SUB_COL,
  Token,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { tradeTokenControl } from '../../src/controls/token-trading/token-trade.controller';
import * as wallet from '../../src/utils/wallet.utils';
import { mockWalletReturnValue, testEnv } from '../set-up';
import { expectThrow, getRandomSymbol, mockIpCheck, wait } from './common';

describe('Trade controller, sell token', () => {
  let memberAddress: NetworkAddress;
  let token: Token;
  let space: Space;
  beforeEach(async () => {
    memberAddress = await testEnv.createMember();
    space = await testEnv.createSpace(memberAddress);
    const tokenId = wallet.getRandomEthAddress();
    const upserToken = {
      project: SOON_PROJECT_ID,
      uid: tokenId,
      symbol: getRandomSymbol(),
      name: 'MyToken',
      status: TokenStatus.AVAILABLE,
      approved: true,
      space: space.uid,
    };
    await database().doc(COL.TOKEN, tokenId).upsert(upserToken);
    token = (await database().doc(COL.TOKEN, tokenId).get())!;
    await database()
      .doc(COL.TOKEN, tokenId, SUB_COL.DISTRIBUTION, memberAddress)
      .upsert({ tokenOwned: 10 });
  });

  it('Should create sell order and cancel it', async () => {
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(memberAddress, request);
    const sell = await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.tradeToken);
    expect(sell.count).toBe(5);
    expect(sell.price).toBe(MIN_IOTA_AMOUNT);
    expect(sell.tokenStatus).toBe(TokenStatus.AVAILABLE);
    const distribution = await database()
      .doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, memberAddress)
      .get();
    expect(distribution?.lockedForSale).toBe(5);
    await wait(async () => {
      const doc = <TokenTradeOrder>await database().doc(COL.TOKEN_MARKET, sell.uid).get();
      return (
        doc.updatedOn !== undefined &&
        dayjs(doc.updatedOn.toDate()).isAfter(doc.createdOn!.toDate())
      );
    });
    const cancelRequest = { uid: sell.uid };
    mockWalletReturnValue(memberAddress, cancelRequest);
    const cancelled = await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.cancelTradeOrder);
    expect(cancelled.status).toBe(TokenTradeOrderStatus.CANCELLED);
    const cancelledDistribution = await database()
      .doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, memberAddress)
      .get();
    expect(cancelledDistribution?.lockedForSale).toBe(0);
  });

  it('Should throw, not enough tokens', async () => {
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 11,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(memberAddress, request);
    await expectThrow(testEnv.wrap(WEN_FUNC.tradeToken), WenError.no_available_tokens_for_sale.key);
  });

  it('Should create, total price too low', async () => {
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2,
      count: 1,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(memberAddress, request);
    const sellOrder = await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.tradeToken);
    expect(sellOrder.price).toBe(MIN_IOTA_AMOUNT / 2);
  });

  it('Should throw on one, not enough tokens', async () => {
    mockWalletReturnValue(memberAddress, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 8,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    mockWalletReturnValue(memberAddress, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 8,
      type: TokenTradeOrderType.SELL,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.tradeToken), WenError.no_available_tokens_for_sale.key);
  });

  it('Should throw, not enough tokens even after cancels', async () => {
    mockWalletReturnValue(memberAddress, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.SELL,
    });
    const sell = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);

    mockWalletReturnValue(memberAddress, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT as any,
      count: 5,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);

    mockWalletReturnValue(memberAddress, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 8,
      type: TokenTradeOrderType.SELL,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.tradeToken), WenError.no_available_tokens_for_sale.key);
    const cancelRequest = { uid: sell.uid };
    mockWalletReturnValue(memberAddress, cancelRequest);
    await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.cancelTradeOrder);
    const distribution = await database()
      .doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, memberAddress)
      .get();
    expect(distribution?.lockedForSale).toBe(5);

    mockWalletReturnValue(memberAddress, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 8,
      type: TokenTradeOrderType.SELL,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.tradeToken), WenError.no_available_tokens_for_sale.key);
  });

  it('Should update sale lock properly', async () => {
    const distDocRef = database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, memberAddress);
    const count = 3;
    const sells = [] as any[];
    for (let i = 0; i < count; ++i) {
      mockWalletReturnValue(memberAddress, {
        symbol: token.symbol,
        price: MIN_IOTA_AMOUNT,
        count: 1,
        type: TokenTradeOrderType.SELL,
      });
      sells.push(await testEnv.wrap(WEN_FUNC.tradeToken));
    }

    await wait(async () => {
      const distribution = await distDocRef.get();
      return distribution?.lockedForSale === count;
    });

    for (let i = 0; i < count; ++i) {
      const cancelRequest = { uid: sells[i].uid };
      mockWalletReturnValue(memberAddress, cancelRequest);
      await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.cancelTradeOrder);
      const distribution = await distDocRef.get();
      expect(distribution?.lockedForSale).toBe(count - i - 1);
    }
  });

  it('Should throw, token not approved', async () => {
    await database().doc(COL.TOKEN, token.uid).update({ approved: false });

    mockWalletReturnValue(memberAddress, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 8,
      type: TokenTradeOrderType.SELL,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.tradeToken), WenError.token_does_not_exist.key);
  });

  it('Should throw, precision too much', async () => {
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT + 0.123,
      count: 5,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(memberAddress, request);
    const sell = await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.tradeToken);
    expect(sell.count).toBe(5);
    const request2 = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT + 0.1543267,
      count: 5,
      type: TokenTradeOrderType.SELL,
    };

    mockWalletReturnValue(memberAddress, request2);
    await expectThrow(testEnv.wrap(WEN_FUNC.tradeToken), WenError.invalid_params.key);
  });

  it('Should fail, country blocked by default', async () => {
    mockIpCheck(true, { common: ['HU'] }, { countryCode: 'HU' });
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.SELL,
    };

    mockWalletReturnValue(memberAddress, request);
    const call = testEnv.mockWrap<Transaction>(tradeTokenControl);
    await expectThrow(call, WenError.blocked_country.key);
  });

  it('Should fail, country blocked for token', async () => {
    mockIpCheck(true, { common: ['USA'], [token.uid]: ['USA', 'HU'] }, { countryCode: 'HU' });
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(memberAddress, request);
    const call = testEnv.mockWrap<Transaction>(tradeTokenControl);
    await expectThrow(call, WenError.blocked_country.key);
  });

  it('Should fail first, tading disabled, then succeeed', async () => {
    await database().doc(COL.TOKEN, token.uid).update({ tradingDisabled: true, public: true });
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(memberAddress, request);
    await expectThrow(testEnv.wrap(WEN_FUNC.tradeToken), WenError.token_trading_disabled.key);
    mockWalletReturnValue(memberAddress, { uid: token.uid });
    await testEnv.wrap(WEN_FUNC.enableTokenTrading);
    mockWalletReturnValue(memberAddress, request);
    const sell = await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.tradeToken);
    expect(sell.count).toBe(5);
    expect(sell.price).toBe(MIN_IOTA_AMOUNT);
    expect(sell.tokenStatus).toBe(TokenStatus.AVAILABLE);
  });
});
