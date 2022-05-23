import dayjs from 'dayjs';
import { MIN_IOTA_AMOUNT } from '../../interfaces/config';
import { WenError } from '../../interfaces/errors';
import { TransactionCreditType, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenBuySellOrder, TokenBuySellOrderStatus, TokenBuySellOrderType, TokenDistribution, TokenStatus } from "../../interfaces/models/token";
import admin from '../../src/admin.config';
import { buyToken, cancelBuyOrSell, sellToken } from "../../src/controls/token-buy-sell.controller";
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { createMember, expectThrow, milestoneProcessed, mockWalletReturnValue, submitMilestoneFunc, wait } from "./common";

let walletSpy: any;

describe('Buy sell controller, sell token', () => {
  let memberAddress: string;
  let token: Token

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy, true)

    const tokenId = wallet.getRandomEthAddress()
    token = <Token>{ uid: tokenId, symbol: 'MYWO', name: 'MyToken', status: TokenStatus.AVAILABLE, approved: true }
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).set(token);
    const distribution = <TokenDistribution>{ tokenOwned: 10 }
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).set(distribution);
  });

  it('Should create sell order and cancel it', async () => {
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    const sell = <TokenBuySellOrder>(await testEnv.wrap(sellToken)({}));
    expect(sell.count).toBe(5)
    expect(sell.price).toBe(MIN_IOTA_AMOUNT)
    const distribution = await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).get()
    expect(distribution.data()?.lockedForSale).toBe(5)

    await wait(async () => {
      const doc = <TokenBuySellOrder>(await admin.firestore().doc(`${COL.TOKEN_MARKET}/${sell.uid}`).get()).data()
      return doc.updatedOn !== undefined && dayjs(doc.updatedOn.toDate()).isAfter(doc.createdOn!.toDate())
    })

    const cancelRequest = { uid: sell.uid }
    mockWalletReturnValue(walletSpy, memberAddress, cancelRequest);
    const cancelled = await testEnv.wrap(cancelBuyOrSell)({});
    expect(cancelled.status).toBe(TokenBuySellOrderStatus.CANCELLED)
    const cancelledDistribution = await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).get()
    expect(cancelledDistribution.data()?.lockedForSale).toBe(0)
  })

  it('Should throw, not enough tokens', async () => {
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 11 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    expectThrow(testEnv.wrap(sellToken)({}), WenError.no_available_tokens_for_sale.key);
  })

  it('Should throw on one, not enough tokens', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 8 });
    await testEnv.wrap(sellToken)({});
    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 8 });
    await expectThrow(testEnv.wrap(sellToken)({}), WenError.no_available_tokens_for_sale.key);
  })

  it('Should throw, token not approved', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false });
    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 8 });
    await expectThrow(testEnv.wrap(sellToken)({}), WenError.token_not_approved.key);
  })
})

describe('Buy sell controller, buy token', () => {
  let memberAddress: string;
  let token: Token

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy, true)

    const tokenId = wallet.getRandomEthAddress()
    token = <Token>{ uid: tokenId, symbol: 'MYWO', name: 'MyToken', space: 'myspace', status: TokenStatus.AVAILABLE, approved: true }
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).set(token);
    const distribution = <TokenDistribution>{ tokenOwned: 10 }
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).set(distribution);

    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    await testEnv.wrap(sellToken)({});
  });

  it('Should create buy order and cancel it', async () => {
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    const order = await testEnv.wrap(buyToken)({});
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, MIN_IOTA_AMOUNT * 5);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', memberAddress).get()
    expect(buySnap.docs.length).toBe(1)
    const buy = <TokenBuySellOrder>buySnap.docs[0].data()
    expect(buy.price).toBe(MIN_IOTA_AMOUNT)
    expect(buy.count).toBe(5)
    expect(buy.type).toBe(TokenBuySellOrderType.BUY)

    const cancelRequest = { uid: buy.uid }
    mockWalletReturnValue(walletSpy, memberAddress, cancelRequest);
    const cancelled = await testEnv.wrap(cancelBuyOrSell)({});
    expect(cancelled.status).toBe(TokenBuySellOrderStatus.CANCELLED)
    const creditSnap = await admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', memberAddress)
      .where('payload.type', '==', TransactionCreditType.TOKEN_BUY)
      .get()
    expect(creditSnap.docs.length).toBe(1)
    expect(creditSnap.docs[0].data()?.payload?.amount).toBe(5 * MIN_IOTA_AMOUNT)
  })

  it('Should throw, token not approved', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false });
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    await expectThrow(testEnv.wrap(buyToken)({}), WenError.token_not_approved.key)
  })
})
