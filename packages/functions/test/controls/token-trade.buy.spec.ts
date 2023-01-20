import {
  COL,
  MIN_IOTA_AMOUNT,
  Token,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  TransactionCreditType,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { cancelTradeOrder } from '../../src/controls/token-trading/token-trade-cancel.controller';
import { tradeToken } from '../../src/controls/token-trading/token-trade.controller';
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
      space: 'myspace',
      status: TokenStatus.AVAILABLE,
      approved: true,
    };
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).set(token);
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

    const buySnap = await admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.BUY)
      .where('owner', '==', memberAddress)
      .get();
    expect(buySnap.docs.length).toBe(1);
    const buy = <TokenTradeOrder>buySnap.docs[0].data();
    expect(buy.price).toBe(MIN_IOTA_AMOUNT);
    expect(buy.count).toBe(5);
    expect(buy.type).toBe(TokenTradeOrderType.BUY);
    expect(buy.tokenStatus).toBe(TokenStatus.AVAILABLE);

    const cancelRequest = { uid: buy.uid };
    mockWalletReturnValue(walletSpy, memberAddress, cancelRequest);
    const cancelled = await testEnv.wrap(cancelTradeOrder)({});
    expect(cancelled.status).toBe(TokenTradeOrderStatus.CANCELLED);

    const creditSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', memberAddress)
      .where('payload.type', '==', TransactionCreditType.TOKEN_BUY)
      .get();
    expect(creditSnap.docs.length).toBe(1);
    expect(creditSnap.docs[0].data()?.payload?.amount).toBe(5 * MIN_IOTA_AMOUNT);
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

    const buysSnap = await admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', memberAddress)
      .get();
    expect(buysSnap.size).toBe(1);

    const creditSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', memberAddress)
      .where('payload.amount', '==', 5 * MIN_IOTA_AMOUNT)
      .get();
    expect(creditSnap.size).toBe(1);
  });

  it('Should throw, token not approved', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false });
    const request = {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.BUY,
    };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.token_not_approved.key);
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
