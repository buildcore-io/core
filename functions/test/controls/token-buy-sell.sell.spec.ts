import dayjs from 'dayjs';
import { MIN_IOTA_AMOUNT } from '../../interfaces/config';
import { WenError } from '../../interfaces/errors';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenBuySellOrder, TokenBuySellOrderStatus, TokenDistribution, TokenStatus } from "../../interfaces/models/token";
import admin from '../../src/admin.config';
import { cancelBuyOrSell, sellToken } from "../../src/controls/token-buy-sell.controller";
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { createMember, expectThrow, mockIpCheck, mockWalletReturnValue, wait } from "./common";

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

  it('Should throw, total price too low', async () => {
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT / 2, count: 1 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    expectThrow(testEnv.wrap(sellToken)({}), WenError.invalid_params.key);
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

  it('Should throw, precision too much', async () => {
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT + 0.123, count: 5 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    const sell = <TokenBuySellOrder>(await testEnv.wrap(sellToken)({}));
    expect(sell.count).toBe(5)

    const request2 = { token: token.uid, price: MIN_IOTA_AMOUNT + 0.1234, count: 5 }
    mockWalletReturnValue(walletSpy, memberAddress, request2);
    expectThrow(testEnv.wrap(sellToken)({}), WenError.invalid_params.key);
  })

  it('Should fail, country blocked by default', async () => {
    mockIpCheck(true, { common: ['HU'] }, { countryCode: 'HU' })
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    await expectThrow(testEnv.wrap(sellToken)({}), WenError.blocked_country.key)
  })

  it('Should fail, country blocked for token', async () => {
    mockIpCheck(true, { common: ['USA'], [token.uid]: ['USA', 'HU'] }, { countryCode: 'HU' })
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    await expectThrow(testEnv.wrap(sellToken)({}), WenError.blocked_country.key)
  })

})
