import { MIN_IOTA_AMOUNT } from '../interfaces/config';
import { COL, SUB_COL } from '../interfaces/models/base';
import { Token, TokenDistribution, TokenStatus } from '../interfaces/models/token';
import admin from '../src/admin.config';
import { tradeToken } from '../src/controls/token-trading/token-trade.controller';
import * as wallet from '../src/utils/wallet.utils';
import { createMember, mockWalletReturnValue } from '../test/controls/common';
import { testEnv } from '../test/set-up';

let walletSpy: any;

describe('Buy sell controller, sell token', () => {
  let memberAddress: string;
  let token: Token;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy);

    const tokenId = wallet.getRandomEthAddress();
    token = <Token>{
      uid: tokenId,
      symbol: 'MYWO',
      name: 'MyToken',
      status: TokenStatus.PRE_MINTED,
      approved: true,
    };
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).set(token);
    const distribution = <TokenDistribution>{ tokenOwned: 10 };
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${tokenId}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
      .set(distribution);
  });

  it('Should create one sell and throw for second sell', async () => {
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 10 };
    mockWalletReturnValue(walletSpy, memberAddress, request);
    const promises = [testEnv.wrap(tradeToken)({}), testEnv.wrap(tradeToken)({})];
    const sells = await Promise.allSettled(promises);
    expect(sells.filter((s) => s.status === 'fulfilled').length).toBe(1);
    expect(sells.filter((s) => s.status === 'rejected').length).toBe(1);
  });
});