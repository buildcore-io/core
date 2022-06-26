import { MIN_IOTA_AMOUNT } from '../../interfaces/config';
import { WenError } from '../../interfaces/errors';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenDistribution, TokenStatus } from "../../interfaces/models/token";
import admin from '../../src/admin.config';
import { buyToken, sellToken } from "../../src/controls/token-buy-sell.controller";
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { createMember, expectThrow, milestoneProcessed, mockIpCheck, mockWalletReturnValue, submitMilestoneFunc } from "./common";

let walletSpy: any;

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

  it.only('Should create buy order and cancel it', async () => {
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    const order = await testEnv.wrap(buyToken)({});
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, MIN_IOTA_AMOUNT * 5);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    // const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET)
    //   .where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', memberAddress).get()
    // expect(buySnap.docs.length).toBe(1)
    // const buy = <TokenBuySellOrder>buySnap.docs[0].data()
    // expect(buy.price).toBe(MIN_IOTA_AMOUNT)
    // expect(buy.count).toBe(5)
    // expect(buy.type).toBe(TokenBuySellOrderType.BUY)

    // const cancelRequest = { uid: buy.uid }
    // mockWalletReturnValue(walletSpy, memberAddress, cancelRequest);
    // const cancelled = await testEnv.wrap(cancelBuyOrSell)({});
    // expect(cancelled.status).toBe(TokenBuySellOrderStatus.CANCELLED)
    // const creditSnap = await admin.firestore().collection(COL.TRANSACTION)
    //   .where('type', '==', TransactionType.CREDIT)
    //   .where('member', '==', memberAddress)
    //   .where('payload.type', '==', TransactionCreditType.TOKEN_BUY)
    //   .get()
    // expect(creditSnap.docs.length).toBe(1)
    // expect(creditSnap.docs[0].data()?.payload?.amount).toBe(5 * MIN_IOTA_AMOUNT)
  })

  it('Should throw, token not approved', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false });
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    await expectThrow(testEnv.wrap(buyToken)({}), WenError.token_not_approved.key)
  })

  it('Should fail, country blocked by default', async () => {
    mockIpCheck(true, { common: ['HU'] }, { countryCode: 'HU' })
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    await expectThrow(testEnv.wrap(buyToken)({}), WenError.blocked_country.key)
  })

  it('Should fail, country blocked for token', async () => {
    mockIpCheck(true, { common: ['USA'], [token.uid]: ['USA', 'HU'] }, { countryCode: 'HU' })
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    await expectThrow(testEnv.wrap(buyToken)({}), WenError.blocked_country.key)
  })
})
