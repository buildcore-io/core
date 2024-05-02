/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  SOON_PROJECT_ID,
  Token,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import { getAddress } from '../src/utils/address.utils';
import { serverTime } from '../src/utils/dateTime.utils';
import * as wallet from '../src/utils/wallet.utils';
import { createRoyaltySpaces, expectThrow, getRandomSymbol, wait } from '../test/controls/common';
import { MEDIA, mockWalletReturnValue, testEnv } from '../test/set-up';
import { awaitTransactionConfirmationsForToken } from './common';
import { requestFundsFromFaucet } from './faucet';

describe('Trade base token controller', () => {
  let seller: Member;
  let token: Token;

  beforeEach(async () => {
    await createRoyaltySpaces();

    const sellerId = await testEnv.createMember();
    seller = <Member>await database().doc(COL.MEMBER, sellerId).get();

    const guardian = await testEnv.createMember();
    const space = await testEnv.createSpace(guardian);

    token = await saveToken(space.uid, guardian);
  });

  it.each([
    { sourceNetwork: Network.ATOI, targetNetwork: Network.RMS },
    { sourceNetwork: Network.RMS, targetNetwork: Network.ATOI },
  ])('Should create trade order', async ({ sourceNetwork, targetNetwork }) => {
    mockWalletReturnValue(seller.uid, {
      symbol: token.symbol,
      count: MIN_IOTA_AMOUNT,
      price: 1,
      type: sourceNetwork === Network.ATOI ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY,
    });
    const tradeOrder = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await requestFundsFromFaucet(sourceNetwork, tradeOrder.payload.targetAddress, MIN_IOTA_AMOUNT);

    const query = database().collection(COL.TOKEN_MARKET).where('owner', '==', seller.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length !== 0;
    });
    const trade = <TokenTradeOrder>(await query.get())[0];
    expect(trade.sourceNetwork).toBe(sourceNetwork);
    expect(trade.targetNetwork).toBe(targetNetwork);
    expect(trade.count).toBe(MIN_IOTA_AMOUNT);
    expect(trade.price).toBe(1);
    expect(trade.type).toBe(
      sourceNetwork === Network.ATOI ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY,
    );

    mockWalletReturnValue(seller.uid, { uid: trade.uid });
    const cancelled = await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.cancelTradeOrder);
    expect(cancelled.status).toBe(TokenTradeOrderStatus.CANCELLED);

    const creditSnap = await database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', seller.uid)
      .get();
    expect(creditSnap.length).toBe(1);
    const credit = <Transaction>creditSnap[0];
    expect(credit.payload.amount).toBe(MIN_IOTA_AMOUNT);
    expect(credit.payload.targetAddress).toBe(getAddress(seller, sourceNetwork));

    await awaitTransactionConfirmationsForToken(token.uid);
  });

  it.each([Network.ATOI, Network.RMS])(
    'Should throw, source address not verified',
    async (network: Network) => {
      await database()
        .doc(COL.MEMBER, seller.uid)
        .update({ [`${network}Address`]: undefined });
      mockWalletReturnValue(seller.uid, {
        symbol: token.symbol,
        count: 10,
        price: MIN_IOTA_AMOUNT,
        type: network === Network.ATOI ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY,
      });
      await expectThrow(
        testEnv.wrap<Transaction>(WEN_FUNC.tradeToken),
        WenError.member_must_have_validated_address.key,
      );
    },
  );

  it.each([
    { sourceNetwork: Network.ATOI, targetNetwork: Network.RMS },
    { sourceNetwork: Network.RMS, targetNetwork: Network.ATOI },
  ])('Should throw, target address not verified', async ({ sourceNetwork, targetNetwork }) => {
    await database()
      .doc(COL.MEMBER, seller.uid)
      .update({ [`${targetNetwork}Address`]: undefined });
    mockWalletReturnValue(seller.uid, {
      symbol: token.symbol,
      count: 10,
      price: MIN_IOTA_AMOUNT,
      type: sourceNetwork === Network.ATOI ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY,
    });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.tradeToken),
      WenError.member_must_have_validated_address.key,
    );
  });
});

const saveToken = async (space: string, guardian: string) => {
  const token = {
    project: SOON_PROJECT_ID,
    symbol: getRandomSymbol(),
    approved: true,
    updatedOn: serverTime(),
    createdOn: serverTime(),
    space,
    uid: wallet.getRandomEthAddress(),
    createdBy: guardian,
    name: 'MyToken',
    status: TokenStatus.BASE,
    access: 0,
    icon: MEDIA,
    mintingData: { network: Network.ATOI },
  } as Token;
  await database().doc(COL.TOKEN, token.uid).create(token);
  return token;
};
