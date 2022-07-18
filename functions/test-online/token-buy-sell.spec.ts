import { MIN_IOTA_AMOUNT } from '../interfaces/config';
import { COL, SUB_COL } from '../interfaces/models/base';
import { Token, TokenDistribution, TokenStatus } from "../interfaces/models/token";
import admin from '../src/admin.config';
import { cancelBuyOrSell } from "../src/controls/token-trading/token-buy.controller";
import { sellToken } from "../src/controls/token-trading/token-sell.controller";
import * as wallet from '../src/utils/wallet.utils';
import { createMember, mockWalletReturnValue } from "../test/controls/common";
import { testEnv } from '../test/set-up';

let walletSpy: any;

describe('Buy sell controller, sell token', () => {
  let memberAddress: string;
  let token: Token

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy)

    const tokenId = wallet.getRandomEthAddress()
    token = <Token>{ uid: tokenId, symbol: 'MYWO', name: 'MyToken', status: TokenStatus.PRE_MINTED, approved: true }
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).set(token);
    const distribution = <TokenDistribution>{ tokenOwned: 10 }
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}/${SUB_COL.DISTRIBUTION}/${memberAddress}`).set(distribution);
  });

  it('Should create one sell and throw for second sell', async () => {
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 10 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    const promises = [testEnv.wrap(sellToken)({}), testEnv.wrap(sellToken)({})]
    const sells = await Promise.allSettled(promises)
    expect(sells.filter(s => s.status === 'fulfilled').length).toBe(1)
    expect(sells.filter(s => s.status === 'rejected').length).toBe(1)
  })

  it("Should not cancel sell twice", async () => {
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 10 }
    mockWalletReturnValue(walletSpy, memberAddress, request);
    const sell = await testEnv.wrap(sellToken)({})

    const cancelRequest = { uid: sell.uid }
    mockWalletReturnValue(walletSpy, memberAddress, cancelRequest);

    const promises = [testEnv.wrap(cancelBuyOrSell)({}), testEnv.wrap(cancelBuyOrSell)({})]
    const result = await Promise.allSettled(promises)
    expect(result.filter(r => r.status === 'rejected').length).toBe(1)
    expect(result.filter(r => r.status === 'fulfilled').length).toBe(1)
  })
})
