/* eslint-disable @typescript-eslint/no-explicit-any */
import { MIN_IOTA_AMOUNT } from '../interfaces/config';
import { WenError } from '../interfaces/errors';
import { Member, Network } from '../interfaces/models';
import { COL } from '../interfaces/models/base';
import { TokenBuySellOrder, TokenBuySellOrderType } from '../interfaces/models/token';
import admin from '../src/admin.config';
import { createMember } from '../src/controls/member.control';
import { tradeBaseTokenOrder } from '../src/controls/token-sale/trade-base-token.controller';
import { AddressDetails, WalletService } from '../src/services/wallet/wallet';
import * as wallet from '../src/utils/wallet.utils';
import { createRoyaltySpaces, expectThrow, mockWalletReturnValue, wait } from '../test/controls/common';
import { projectId, testEnv } from '../test/set-up';
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
    await testEnv.firestore.clearFirestoreData({ projectId })
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
  })

  it.each([
    { sourceNetwork: Network.ATOI, targetNetwork: Network.RMS },
    { sourceNetwork: Network.RMS, targetNetwork: Network.ATOI }
  ])('Should create trade order', async ({ sourceNetwork, targetNetwork }) => {
    await requestFundsFromFaucet(sourceNetwork, validateAddress[sourceNetwork].bech32, 10 * MIN_IOTA_AMOUNT)
    const wallet = WalletService.newWallet(sourceNetwork)

    mockWalletReturnValue(walletSpy, seller.uid, { sourceNetwork, count: 10, price: MIN_IOTA_AMOUNT })
    const sellOrder = await testEnv.wrap(tradeBaseTokenOrder)({})
    await wallet.sendFromGenesis(validateAddress[sourceNetwork], sellOrder.payload.targetAddress, 10 * MIN_IOTA_AMOUNT, '')

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller.uid)
    await wait(async () => {
      const snap = await query.get()
      return snap.size !== 0
    })
    const sell = <TokenBuySellOrder>(await query.get()).docs[0].data()
    await admin.firestore().doc(`${COL.TOKEN_MARKET}/${sell.uid}`).delete()
    expect(sell.sourceNetwork).toBe(sourceNetwork)
    expect(sell.targetNetwork).toBe(targetNetwork)
    expect(sell.count).toBe(10)
    expect(sell.price).toBe(MIN_IOTA_AMOUNT)
    expect(sell.type).toBe(sourceNetwork === Network.RMS ? TokenBuySellOrderType.SELL : TokenBuySellOrderType.BUY)
  })

  it.each([Network.ATOI, Network.RMS])('Should throw, source address not verified', async (sourceNetwork: Network) => {
    await admin.firestore().doc(`${COL.MEMBER}/${seller.uid}`).update({ [`validatedAddress.${sourceNetwork}`]: admin.firestore.FieldValue.delete() })
    mockWalletReturnValue(walletSpy, seller.uid, { sourceNetwork, count: 10, price: MIN_IOTA_AMOUNT })
    await expectThrow(testEnv.wrap(tradeBaseTokenOrder)({}), WenError.member_must_have_validated_address.key)
  })

  it.each([
    { sourceNetwork: Network.ATOI, targetNetwork: Network.RMS },
    { sourceNetwork: Network.RMS, targetNetwork: Network.ATOI }
  ])('Should throw, target address not verified', async ({ sourceNetwork, targetNetwork }) => {
    await admin.firestore().doc(`${COL.MEMBER}/${seller.uid}`).update({ [`validatedAddress.${targetNetwork}`]: admin.firestore.FieldValue.delete() })
    mockWalletReturnValue(walletSpy, seller.uid, { sourceNetwork, count: 10, price: MIN_IOTA_AMOUNT })
    await expectThrow(testEnv.wrap(tradeBaseTokenOrder)({}), WenError.member_must_have_validated_address.key)
  })

  afterEach(async () => {
    await listenerATOI.cancel()
    await listenerRMS.cancel()
  })
})
