/* eslint-disable @typescript-eslint/no-explicit-any */
import { MIN_IOTA_AMOUNT } from '../interfaces/config';
import { WenError } from '../interfaces/errors';
import { Member, Network, Transaction, TransactionType } from '../interfaces/models';
import { COL } from '../interfaces/models/base';
import { Token, TokenStatus, TokenTradeOrder, TokenTradeOrderStatus, TokenTradeOrderType } from '../interfaces/models/token';
import admin from '../src/admin.config';
import { createMember } from '../src/controls/member.control';
import { cancelTradeOrder } from '../src/controls/token-trading/token-buy.controller';
import { tradeBaseTokenOrder } from '../src/controls/token-trading/trade-base-token.controller';
import { AddressDetails, WalletService } from '../src/services/wallet/wallet';
import { getAddress } from '../src/utils/address.utils';
import { serverTime } from '../src/utils/dateTime.utils';
import * as wallet from '../src/utils/wallet.utils';
import { createMember as createMemberTest, createRoyaltySpaces, createSpace, expectThrow, mockWalletReturnValue, wait } from '../test/controls/common';
import { testEnv } from '../test/set-up';
import { addValidatedAddress } from './common';
import { MilestoneListener } from './db-sync.utils';
import { requestFundsFromFaucet } from './faucet';

let walletSpy: any;

describe('Trade base token controller', () => {
  let seller: Member
  const validateAddress = {} as { [key: string]: AddressDetails }
  let listenerATOI: MilestoneListener
  let listenerRMS: MilestoneListener

  beforeEach(async () => {
    await createRoyaltySpaces()
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    listenerATOI = new MilestoneListener(Network.ATOI)
    listenerRMS = new MilestoneListener(Network.RMS)

    const sellerId = wallet.getRandomEthAddress();
    mockWalletReturnValue(walletSpy, sellerId, {})
    await testEnv.wrap(createMember)(sellerId);
    validateAddress[Network.ATOI] = await addValidatedAddress(Network.ATOI, sellerId)
    validateAddress[Network.RMS] = await addValidatedAddress(Network.RMS, sellerId)
    seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sellerId}`).get()).data()


    const guardian = await createMemberTest(walletSpy)
    const space = await createSpace(walletSpy, guardian)

    await saveToken(space.uid, guardian, Network.ATOI)
  })

  it.each([
    { sourceNetwork: Network.ATOI, targetNetwork: Network.RMS },
    { sourceNetwork: Network.RMS, targetNetwork: Network.ATOI }
  ])('Should create trade order', async ({ sourceNetwork, targetNetwork }) => {
    await requestFundsFromFaucet(sourceNetwork, validateAddress[sourceNetwork].bech32, MIN_IOTA_AMOUNT)
    const wallet = await WalletService.newWallet(sourceNetwork)

    mockWalletReturnValue(walletSpy, seller.uid, { network: sourceNetwork, count: 1, price: MIN_IOTA_AMOUNT })
    const sellOrder = await testEnv.wrap(tradeBaseTokenOrder)({})
    await wallet.send(validateAddress[sourceNetwork], sellOrder.payload.targetAddress, MIN_IOTA_AMOUNT)

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller.uid)
    await wait(async () => {
      const snap = await query.get()
      return snap.size !== 0
    })
    const sell = <TokenTradeOrder>(await query.get()).docs[0].data()
    expect(sell.sourceNetwork).toBe(sourceNetwork)
    expect(sell.targetNetwork).toBe(targetNetwork)
    expect(sell.count).toBe(1)
    expect(sell.price).toBe(MIN_IOTA_AMOUNT)
    expect(sell.type).toBe(sourceNetwork === Network.RMS ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY)

    mockWalletReturnValue(walletSpy, seller.uid, { uid: sell.uid });
    const cancelled = await testEnv.wrap(cancelTradeOrder)({});
    expect(cancelled.status).toBe(TokenTradeOrderStatus.CANCELLED)

    const creditSnap = await admin.firestore().collection(COL.TRANSACTION).where('type', '==', TransactionType.CREDIT).where('member', '==', seller.uid).get()
    expect(creditSnap.size).toBe(1)
    const credit = <Transaction>(creditSnap.docs[0].data())
    expect(credit.payload.amount).toBe(MIN_IOTA_AMOUNT)
    expect(credit.payload.targetAddress).toBe(getAddress(seller, sourceNetwork))
  })

  it.each([Network.ATOI, Network.RMS])('Should throw, source address not verified', async (sourceNetwork: Network) => {
    await admin.firestore().doc(`${COL.MEMBER}/${seller.uid}`).update({ [`validatedAddress.${sourceNetwork}`]: admin.firestore.FieldValue.delete() })
    mockWalletReturnValue(walletSpy, seller.uid, { network: sourceNetwork, count: 10, price: MIN_IOTA_AMOUNT })
    await expectThrow(testEnv.wrap(tradeBaseTokenOrder)({}), WenError.member_must_have_validated_address.key)
  })

  it.each([
    { sourceNetwork: Network.ATOI, targetNetwork: Network.RMS },
    { sourceNetwork: Network.RMS, targetNetwork: Network.ATOI }
  ])('Should throw, target address not verified', async ({ sourceNetwork, targetNetwork }) => {
    await admin.firestore().doc(`${COL.MEMBER}/${seller.uid}`).update({ [`validatedAddress.${targetNetwork}`]: admin.firestore.FieldValue.delete() })
    mockWalletReturnValue(walletSpy, seller.uid, { network: sourceNetwork, count: 10, price: MIN_IOTA_AMOUNT })
    await expectThrow(testEnv.wrap(tradeBaseTokenOrder)({}), WenError.member_must_have_validated_address.key)
  })

  afterEach(async () => {
    await listenerATOI.cancel()
    await listenerRMS.cancel()
  })
})

const saveToken = async (space: string, guardian: string, network: Network) => {
  const token = ({
    symbol: network.toUpperCase(),
    approved: true,
    updatedOn: serverTime(),
    createdOn: serverTime(),
    space,
    uid: wallet.getRandomEthAddress(),
    createdBy: guardian,
    name: 'MyToken',
    status: TokenStatus.BASE,
    access: 0
  })
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token as Token
}
