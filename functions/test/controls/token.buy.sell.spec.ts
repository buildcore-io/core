import * as admin from 'firebase-admin';
import { MIN_IOTA_AMOUNT } from '../../interfaces/config';
import { WenError } from '../../interfaces/errors';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenBuySellOrder, TokenDistribution } from "../../interfaces/models/token";
import { buyToken, sellToken } from "../../src/controls/token.buy.sell.controller";
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { createMember, expectThrow, milestoneProcessed, mockWalletReturnValue, submitMilestoneFunc } from "./common";

let walletSpy: any;

describe('Buy sell controller, sell token', () => {
  let memberAddress: string;
  let token: Token

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy, true)

    const tokenId = wallet.getRandomEthAddress()
    token = <Token>{ uid: tokenId, symbol: 'MYWO', name: 'MyToken', }
    await admin.firestore().doc(`${COL.TOKENS}/${tokenId}`).set(token);
    const distribution = <TokenDistribution>{ tokenOwned: 10 }
    await admin.firestore().doc(`${COL.TOKENS}/${tokenId}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).set(distribution);
  });

  it('Should create sell order', async () => {
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    const sell = await testEnv.wrap(sellToken)({});
    expect(sell.count).toBe(5)
    expect(sell.price).toBe(MIN_IOTA_AMOUNT)
    const distribution = await admin.firestore().doc(`${COL.TOKENS}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).get()
    expect(distribution.data()?.lockedForSale).toBe(5)
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
})

describe('Buy sell controller, buy token', () => {
  let memberAddress: string;
  let token: Token

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy, true)

    const tokenId = wallet.getRandomEthAddress()
    token = <Token>{ uid: tokenId, symbol: 'MYWO', name: 'MyToken', space: 'myspace' }
    await admin.firestore().doc(`${COL.TOKENS}/${tokenId}`).set(token);
    const distribution = <TokenDistribution>{ tokenOwned: 10 }
    await admin.firestore().doc(`${COL.TOKENS}/${tokenId}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).set(distribution);

    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    await testEnv.wrap(sellToken)({});
  });

  it('Should create buy order', async () => {
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    const order = await testEnv.wrap(buyToken)({});

    const milestone = await submitMilestoneFunc(order.payload.targetAddress, MIN_IOTA_AMOUNT * 5);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET).where('type', '==', 'buy').where('owner', '==', memberAddress).get()
    expect(buySnap.docs.length).toBe(1)
    const buy = <TokenBuySellOrder>buySnap.docs[0].data()
    expect(buy.price).toBe(MIN_IOTA_AMOUNT)
    expect(buy.count).toBe(5)
    expect(buy.type).toBe('buy')
  })
})
