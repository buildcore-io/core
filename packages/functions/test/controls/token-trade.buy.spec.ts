import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  NetworkAddress,
  Token,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import { cancelTradeOrder, tradeToken } from '../../src/runtime/firebase/token/trading';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import {
  createMember,
  expectThrow,
  getRandomSymbol,
  milestoneProcessed,
  mockIpCheck,
  mockWalletReturnValue,
  submitMilestoneFunc,
} from './common';

let walletSpy: any;

describe('Trade controller, buy token', () => {
  let memberAddress: NetworkAddress;
  let token: Token;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy);

    const tokenId = wallet.getRandomEthAddress();
    token = <Token>{
      uid: tokenId,
      symbol: getRandomSymbol(),
      name: 'MyToken',
      space: 'myspace',
      status: TokenStatus.AVAILABLE,
      approved: true,
    };
    await build5Db().doc(`${COL.TOKEN}/${tokenId}`).set(token);
  });

  it('Should create buy order and cancel it', async () => {
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.BUY,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    const order = await testEnv.wrap(tradeToken)({});
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, MIN_IOTA_AMOUNT * 5);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    const buySnap = await build5Db()
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
    mockWalletReturnValue(walletSpy, memberAddress, cancelRequest);
    const cancelled = await testEnv.wrap(cancelTradeOrder)({});
    expect(cancelled.status).toBe(TokenTradeOrderStatus.CANCELLED);

    const creditSnap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', memberAddress)
      .where('payload.type', '==', TransactionPayloadType.TOKEN_BUY)
      .get<Transaction>();
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
    mockWalletReturnValue(walletSpy, memberAddress, request);
    const order = await testEnv.wrap(tradeToken)({});

    const milestone = await submitMilestoneFunc(order.payload.targetAddress, MIN_IOTA_AMOUNT * 5);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    const milestone2 = await submitMilestoneFunc(order.payload.targetAddress, MIN_IOTA_AMOUNT * 5);
    await milestoneProcessed(milestone2.milestone, milestone2.tranId);

    const buysSnap = await build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', memberAddress)
      .get();
    expect(buysSnap.length).toBe(1);

    const creditSnap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', memberAddress)
      .where('payload.amount', '==', 5 * MIN_IOTA_AMOUNT)
      .get();
    expect(creditSnap.length).toBe(1);
  });

  it('Should throw, token not approved', async () => {
    await build5Db().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false });
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.BUY,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.token_does_not_exist.key);
  });

  it('Should fail, country blocked by default', async () => {
    mockIpCheck(true, { common: ['HU'] }, { countryCode: 'HU' });
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.BUY,
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
      type: TokenTradeOrderType.BUY,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.blocked_country.key);
  });
});
