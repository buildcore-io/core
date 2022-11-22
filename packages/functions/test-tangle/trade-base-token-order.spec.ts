/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  Token,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import admin from '../src/admin.config';
import { createMember } from '../src/controls/member.control';
import { cancelTradeOrder } from '../src/controls/token-trading/token-trade-cancel.controller';
import { tradeToken } from '../src/controls/token-trading/token-trade.controller';
import { AddressDetails } from '../src/services/wallet/wallet';
import { getAddress } from '../src/utils/address.utils';
import { serverTime } from '../src/utils/dateTime.utils';
import * as wallet from '../src/utils/wallet.utils';
import {
  createMember as createMemberTest,
  createRoyaltySpaces,
  createSpace,
  expectThrow,
  mockWalletReturnValue,
  wait,
} from '../test/controls/common';
import { MEDIA, testEnv } from '../test/set-up';
import { addValidatedAddress, awaitTransactionConfirmationsForToken } from './common';
import { requestFundsFromFaucet } from './faucet';

let walletSpy: any;

describe('Trade base token controller', () => {
  let seller: Member;
  const validateAddress = {} as { [key: string]: AddressDetails };
  let token: string;

  beforeEach(async () => {
    await createRoyaltySpaces();
    walletSpy = jest.spyOn(wallet, 'decodeAuth');

    const sellerId = wallet.getRandomEthAddress();
    mockWalletReturnValue(walletSpy, sellerId, {});
    await testEnv.wrap(createMember)(sellerId);
    validateAddress[Network.ATOI] = await addValidatedAddress(Network.ATOI, sellerId);
    validateAddress[Network.RMS] = await addValidatedAddress(Network.RMS, sellerId);
    seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sellerId}`).get()).data();

    const guardian = await createMemberTest(walletSpy);
    const space = await createSpace(walletSpy, guardian);

    token = (await saveToken(space.uid, guardian, Network.ATOI)).uid;
  });

  it.each([
    { sourceNetwork: Network.ATOI, targetNetwork: Network.RMS },
    { sourceNetwork: Network.RMS, targetNetwork: Network.ATOI },
  ])('Should create trade order', async ({ sourceNetwork, targetNetwork }) => {
    mockWalletReturnValue(walletSpy, seller.uid, {
      token,
      count: MIN_IOTA_AMOUNT,
      price: 1,
      type: sourceNetwork === Network.ATOI ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY,
    });
    const tradeOrder = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(sourceNetwork, tradeOrder.payload.targetAddress, MIN_IOTA_AMOUNT);

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.size !== 0;
    });
    const trade = <TokenTradeOrder>(await query.get()).docs[0].data();
    expect(trade.sourceNetwork).toBe(sourceNetwork);
    expect(trade.targetNetwork).toBe(targetNetwork);
    expect(trade.count).toBe(MIN_IOTA_AMOUNT);
    expect(trade.price).toBe(1);
    expect(trade.type).toBe(
      sourceNetwork === Network.ATOI ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY,
    );

    mockWalletReturnValue(walletSpy, seller.uid, { uid: trade.uid });
    const cancelled = await testEnv.wrap(cancelTradeOrder)({});
    expect(cancelled.status).toBe(TokenTradeOrderStatus.CANCELLED);

    const creditSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', seller.uid)
      .get();
    expect(creditSnap.size).toBe(1);
    const credit = <Transaction>creditSnap.docs[0].data();
    expect(credit.payload.amount).toBe(MIN_IOTA_AMOUNT);
    expect(credit.payload.targetAddress).toBe(getAddress(seller, sourceNetwork));

    await awaitTransactionConfirmationsForToken(token);
  });

  it.each([Network.ATOI, Network.RMS])(
    'Should throw, source address not verified',
    async (network: Network) => {
      await admin
        .firestore()
        .doc(`${COL.MEMBER}/${seller.uid}`)
        .update({ [`validatedAddress.${network}`]: admin.firestore.FieldValue.delete() });
      mockWalletReturnValue(walletSpy, seller.uid, {
        token,
        count: 10,
        price: MIN_IOTA_AMOUNT,
        type: network === Network.ATOI ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY,
      });
      await expectThrow(
        testEnv.wrap(tradeToken)({}),
        WenError.member_must_have_validated_address.key,
      );
    },
  );

  it.each([
    { sourceNetwork: Network.ATOI, targetNetwork: Network.RMS },
    { sourceNetwork: Network.RMS, targetNetwork: Network.ATOI },
  ])('Should throw, target address not verified', async ({ sourceNetwork, targetNetwork }) => {
    await admin
      .firestore()
      .doc(`${COL.MEMBER}/${seller.uid}`)
      .update({ [`validatedAddress.${targetNetwork}`]: admin.firestore.FieldValue.delete() });
    mockWalletReturnValue(walletSpy, seller.uid, {
      token,
      count: 10,
      price: MIN_IOTA_AMOUNT,
      type: sourceNetwork === Network.ATOI ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY,
    });
    await expectThrow(
      testEnv.wrap(tradeToken)({}),
      WenError.member_must_have_validated_address.key,
    );
  });
});

const saveToken = async (space: string, guardian: string, network: Network) => {
  const token = {
    symbol: network.toUpperCase(),
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
  };
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token as Token;
};
