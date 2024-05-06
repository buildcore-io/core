import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  NetworkAddress,
  SOON_PROJECT_ID,
  Token,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import { tradeTokenControl } from '../../src/controls/token-trading/token-trade.controller';
import * as wallet from '../../src/utils/wallet.utils';
import { mockWalletReturnValue, testEnv } from '../set-up';
import { expectThrow, getRandomSymbol, mockIpCheck, submitMilestoneFunc } from './common';

describe('Trade controller, buy token', () => {
  let memberAddress: NetworkAddress;
  let token: Token;

  beforeEach(async () => {
    memberAddress = await testEnv.createMember();

    const tokenId = wallet.getRandomEthAddress();
    const tokenUpsert = {
      project: SOON_PROJECT_ID,
      uid: tokenId,
      symbol: getRandomSymbol(),
      name: 'MyToken',
      space: 'myspace',
      status: TokenStatus.AVAILABLE,
      approved: true,
    };
    await database().doc(COL.TOKEN, tokenId).upsert(tokenUpsert);
    token = (await database().doc(COL.TOKEN, tokenId).get())!;
  });

  it('Should create buy order and cancel it', async () => {
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.BUY,
    };
    mockWalletReturnValue(memberAddress, request);
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await submitMilestoneFunc(order, MIN_IOTA_AMOUNT * 5);

    const buySnap = await database()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.BUY)
      .where('owner', '==', memberAddress)
      .get();
    expect(buySnap.length).toBe(1);
    const buy = <TokenTradeOrder>buySnap[0];
    expect(buy.price).toBe(MIN_IOTA_AMOUNT);
    expect(buy.count).toBe(5);
    expect(buy.type).toBe(TokenTradeOrderType.BUY);
    expect(buy.tokenStatus).toBe(TokenStatus.AVAILABLE);

    const cancelRequest = { uid: buy.uid };
    mockWalletReturnValue(memberAddress, cancelRequest);
    const cancelled = await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.cancelTradeOrder);
    expect(cancelled.status).toBe(TokenTradeOrderStatus.CANCELLED);

    const creditSnap = await database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', memberAddress)
      .where('payload_type', '==', TransactionPayloadType.TOKEN_BUY)
      .get();
    expect(creditSnap.length).toBe(1);
    expect(creditSnap[0]?.payload?.amount).toBe(5 * MIN_IOTA_AMOUNT);
  });

  it('Should not be able to pay buy order twice', async () => {
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.BUY,
    };
    mockWalletReturnValue(memberAddress, request);
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);

    await submitMilestoneFunc(order, MIN_IOTA_AMOUNT * 5);
    await submitMilestoneFunc(order, MIN_IOTA_AMOUNT * 5);

    const buysSnap = await database()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', memberAddress)
      .get();
    expect(buysSnap.length).toBe(1);

    const creditSnap = await database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', memberAddress)
      .where('payload_amount', '==', 5 * MIN_IOTA_AMOUNT)
      .get();
    expect(creditSnap.length).toBe(1);
  });

  it('Should throw, token not approved', async () => {
    await database().doc(COL.TOKEN, token.uid).update({ approved: false });
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.BUY,
    };
    mockWalletReturnValue(memberAddress, request);
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.tradeToken),
      WenError.token_does_not_exist.key,
    );
  });

  it('Should fail, country blocked by default', async () => {
    mockIpCheck(true, { common: ['HU'] }, { countryCode: 'HU' });
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.BUY,
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
      type: TokenTradeOrderType.BUY,
    };
    mockWalletReturnValue(memberAddress, request);
    const call = testEnv.mockWrap<Transaction>(tradeTokenControl);
    await expectThrow(call, WenError.blocked_country.key);
  });
});
