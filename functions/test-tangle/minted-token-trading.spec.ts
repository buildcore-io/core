/* eslint-disable @typescript-eslint/no-explicit-any */

import { HexHelper } from '@iota/util.js-next';
import bigInt from 'big-integer';
import { MIN_IOTA_AMOUNT } from '../interfaces/config';
import { WenError } from '../interfaces/errors';
import { Member, Network, Space, Transaction, TransactionType } from '../interfaces/models';
import { COL } from '../interfaces/models/base';
import { Token, TokenStatus, TokenTradeOrder, TokenTradeOrderType } from '../interfaces/models/token';
import admin from '../src/admin.config';
import { cancelTradeOrder } from '../src/controls/token-trading/token-trade-cancel.controller';
import { tradeToken } from '../src/controls/token-trading/token-trade.controller';
import { MnemonicService } from '../src/services/wallet/mnemonic';
import { SmrWallet } from '../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../src/services/wallet/wallet';
import { getAddress } from '../src/utils/address.utils';
import { serverTime } from '../src/utils/dateTime.utils';
import * as wallet from '../src/utils/wallet.utils';
import { createMember, createRoyaltySpaces, createSpace, expectThrow, getRandomSymbol, mockWalletReturnValue, wait } from '../test/controls/common';
import { testEnv } from '../test/set-up';
import { waitForBlockToBeIncluded } from './common';
import { MilestoneListener } from './db-sync.utils';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from './faucet';

let walletSpy: any;
const network = Network.RMS

describe('Token minting', () => {
  let seller: string
  let listener: MilestoneListener
  let space: Space;
  let token: Token
  let sellerAddress: AddressDetails
  let buyer: string
  let buyerAddress: AddressDetails

  let guardian: string;
  let walletService: SmrWallet

  beforeAll(async () => {
    walletService = await WalletService.newWallet(network) as SmrWallet
    await createRoyaltySpaces()
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
  })

  beforeEach(async () => {
    listener = new MilestoneListener(network)
    guardian = await createMember(walletSpy)
    space = await createSpace(walletSpy, guardian)
    token = await saveToken(space.uid, guardian, walletService) as Token
  })

  beforeEach(async () => {
    seller = await createMember(walletSpy)
    const sellerDoc = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${seller}`).get()).data()
    sellerAddress = await walletService.getAddressDetails(getAddress(sellerDoc, network))
    await requestFundsFromFaucet(network, sellerAddress.bech32, 20 * MIN_IOTA_AMOUNT)

    await requestMintedTokenFromFaucet(walletService, sellerAddress, token.mintingData?.tokenId!, VAULT_MNEMONIC)

    buyer = await createMember(walletSpy)
    const buyerDoc = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buyer}`).get()).data()
    buyerAddress = await walletService.getAddressDetails(getAddress(buyerDoc, network))

    await requestFundsFromFaucet(network, buyerAddress.bech32, 20 * MIN_IOTA_AMOUNT)
  })

  it('Fulfill sell with same price', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.SELL })
    const sellOrder: Transaction = await testEnv.wrap(tradeToken)({})
    await walletService.send(sellerAddress, sellOrder.payload.targetAddress, 0, { nativeTokens: [{ amount: HexHelper.fromBigInt256(bigInt(10)), id: token.mintingData?.tokenId! }] })

    mockWalletReturnValue(walletSpy, buyer, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.BUY })
    const buyOrder: Transaction = await testEnv.wrap(tradeToken)({})
    await walletService.send(buyerAddress, buyOrder.payload.targetAddress, 10 * MIN_IOTA_AMOUNT)

    const billPaymentsQuery = admin.firestore().collection(COL.TRANSACTION)
      .where('member', 'in', [seller, buyer]).where('type', '==', TransactionType.BILL_PAYMENT)
    await wait(async () => {
      const snap = await billPaymentsQuery.get()
      return snap.size === 4
    })

    const billPayments = (await billPaymentsQuery.get()).docs.map(d => d.data() as Transaction)
    const paymentToSeller = billPayments.find(bp => bp.payload.targetAddress === sellerAddress.bech32)!
    expect(paymentToSeller.payload.amount).toBe(9606800)
    expect(paymentToSeller.payload.sourceAddress).toBe(buyOrder.payload.targetAddress)
    expect(paymentToSeller.payload.storageReturn).toBeUndefined()

    const royaltyOnePayment = billPayments.find(bp => bp.payload.amount === 271800)!
    expect(royaltyOnePayment.payload.storageReturn.address).toBe(sellerAddress.bech32)
    expect(royaltyOnePayment.payload.sourceAddress).toBe(buyOrder.payload.targetAddress)
    expect(royaltyOnePayment.payload.storageReturn.amount).toBe(46800)

    const royaltyTwoPayment = billPayments.find(bp => bp.payload.amount === 71800)!
    expect(royaltyTwoPayment.payload.storageReturn.address).toBe(sellerAddress.bech32)
    expect(royaltyTwoPayment.payload.sourceAddress).toBe(buyOrder.payload.targetAddress)
    expect(royaltyTwoPayment.payload.storageReturn.amount).toBe(46800)

    const paymentToBuyer = billPayments.find(bp => bp.payload.targetAddress === buyerAddress.bech32)!
    expect(paymentToBuyer.payload.amount).toBe(49600)
    expect(paymentToBuyer.payload.nativeTokens[0].amount).toBe(10)
    expect(paymentToBuyer.payload.sourceAddress).toBe(sellOrder.payload.targetAddress)
    expect(paymentToBuyer.payload.storageDepositSourceAddress).toBe(buyOrder.payload.targetAddress)

    const sellerCreditSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller).where('type', '==', TransactionType.CREDIT).get()
    expect(sellerCreditSnap.size).toBe(1)
    const sellerCredit = sellerCreditSnap.docs.map(d => d.data() as Transaction)[0]
    expect(sellerCredit.payload.amount).toBe(49600)
  })

  it('Fulfill buy with half price', async () => {

    mockWalletReturnValue(walletSpy, seller, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.SELL })
    const sellOrder = await testEnv.wrap(tradeToken)({})
    await walletService.send(sellerAddress, sellOrder.payload.targetAddress, 0, { nativeTokens: [{ amount: HexHelper.fromBigInt256(bigInt(10)), id: token.mintingData?.tokenId! }] })

    mockWalletReturnValue(walletSpy, buyer, { token: token.uid, count: 10, price: 2 * MIN_IOTA_AMOUNT, type: TokenTradeOrderType.BUY })
    const buyOrder = await testEnv.wrap(tradeToken)({})
    await walletService.send(buyerAddress, buyOrder.payload.targetAddress, 10 * 2 * MIN_IOTA_AMOUNT)


    const billPaymentsQuery = admin.firestore().collection(COL.TRANSACTION)
      .where('member', 'in', [seller, buyer]).where('type', '==', TransactionType.BILL_PAYMENT)
    await wait(async () => {
      const snap = await billPaymentsQuery.get()
      return snap.size === 4
    })

    const billPayments = (await billPaymentsQuery.get()).docs.map(d => d.data() as Transaction)
    const paymentToSeller = billPayments.find(bp => bp.payload.targetAddress === sellerAddress.bech32)!
    expect(paymentToSeller.payload.amount).toBe(9606800)
    expect(paymentToSeller.payload.sourceAddress).toBe(buyOrder.payload.targetAddress)
    expect(paymentToSeller.payload.storageReturn).toBeUndefined()

    const royaltyOnePayment = billPayments.find(bp => bp.payload.amount === 271800)!
    expect(royaltyOnePayment.payload.storageReturn.address).toBe(sellerAddress.bech32)
    expect(royaltyOnePayment.payload.sourceAddress).toBe(buyOrder.payload.targetAddress)
    expect(royaltyOnePayment.payload.storageReturn.amount).toBe(46800)

    const royaltyTwoPayment = billPayments.find(bp => bp.payload.amount === 71800)!
    expect(royaltyTwoPayment.payload.storageReturn.address).toBe(sellerAddress.bech32)
    expect(royaltyTwoPayment.payload.sourceAddress).toBe(buyOrder.payload.targetAddress)
    expect(royaltyTwoPayment.payload.storageReturn.amount).toBe(46800)

    const paymentToBuyer = billPayments.find(bp => bp.payload.targetAddress === buyerAddress.bech32)!
    expect(paymentToBuyer.payload.amount).toBe(49600)
    expect(paymentToBuyer.payload.nativeTokens[0].amount).toBe(10)
    expect(paymentToBuyer.payload.sourceAddress).toBe(sellOrder.payload.targetAddress)
    expect(paymentToBuyer.payload.storageDepositSourceAddress).toBe(buyOrder.payload.targetAddress)

    const sellerCreditSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller).where('type', '==', TransactionType.CREDIT).get()
    expect(sellerCreditSnap.size).toBe(1)
    const sellerCredit = sellerCreditSnap.docs.map(d => d.data() as Transaction)[0]
    expect(sellerCredit.payload.amount).toBe(49600)

    const buyerCreditSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer).where('type', '==', TransactionType.CREDIT).get()
    expect(buyerCreditSnap.size).toBe(1)
    const buyerCredit = buyerCreditSnap.docs.map(d => d.data() as Transaction)[0]
    expect(buyerCredit.payload.amount).toBe(10 * MIN_IOTA_AMOUNT)
  })

  it('Fulfill sell with two buys', async () => {
    mockWalletReturnValue(walletSpy, buyer, { token: token.uid, count: 5, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.BUY })
    const buyOrder = await testEnv.wrap(tradeToken)({})
    const blockId = await walletService.send(buyerAddress, buyOrder.payload.targetAddress, 5 * MIN_IOTA_AMOUNT)
    await waitForBlockToBeIncluded(walletService.client, blockId)

    mockWalletReturnValue(walletSpy, buyer, { token: token.uid, count: 5, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.BUY })
    const buyOrder2 = await testEnv.wrap(tradeToken)({})
    await walletService.send(buyerAddress, buyOrder2.payload.targetAddress, 5 * MIN_IOTA_AMOUNT)

    mockWalletReturnValue(walletSpy, seller, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.SELL })
    const sellOrder = await testEnv.wrap(tradeToken)({})
    await walletService.send(sellerAddress, sellOrder.payload.targetAddress, 0, { nativeTokens: [{ amount: HexHelper.fromBigInt256(bigInt(10)), id: token.mintingData?.tokenId! }] })

    await wait(async () => {
      const orders = (await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get()).docs.map(d => <TokenTradeOrder>d.data())
      const fulfilled = orders.filter(o => o.count === o.fulfilled)
      return fulfilled.length === orders.length
    })
  })

  it('Create and cancel sell', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.SELL })
    const sellOrder = await testEnv.wrap(tradeToken)({})
    await walletService.send(sellerAddress, sellOrder.payload.targetAddress, 0, { nativeTokens: [{ amount: HexHelper.fromBigInt256(bigInt(10)), id: token.mintingData?.tokenId! }] })
    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller)
    await wait(async () => {
      const snap = await query.get()
      return snap.size !== 0
    })
    const sell = <TokenTradeOrder>(await query.get()).docs[0].data()
    mockWalletReturnValue(walletSpy, seller, { uid: sell.uid });
    await testEnv.wrap(cancelTradeOrder)({});

    const sellerCreditSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller).where('type', '==', TransactionType.CREDIT).get()
    expect(sellerCreditSnap.size).toBe(1)
    const sellerCredit = sellerCreditSnap.docs[0].data() as Transaction
    expect(sellerCredit.payload.amount).toBe(49600)
    expect(sellerCredit.payload.nativeTokens[0].amount).toBe(10)
  })

  it('Create and cancel buy', async () => {
    mockWalletReturnValue(walletSpy, buyer, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.BUY })
    const buyOrder = await testEnv.wrap(tradeToken)({})
    await walletService.send(buyerAddress, buyOrder.payload.targetAddress, 10 * MIN_IOTA_AMOUNT)

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer)
    await wait(async () => {
      const snap = await query.get()
      return snap.size !== 0
    })
    const buy = <TokenTradeOrder>(await query.get()).docs[0].data()
    mockWalletReturnValue(walletSpy, buyer, { uid: buy.uid });
    await testEnv.wrap(cancelTradeOrder)({});

    const buyerCreditnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer).where('type', '==', TransactionType.CREDIT).get()
    expect(buyerCreditnap.size).toBe(1)
    expect(buyerCreditnap.docs[0].data()?.payload?.amount).toBe(10 * MIN_IOTA_AMOUNT)
  })

  it('Half fulfill buy and cancel it', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, count: 5, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.SELL })
    const sellOrder = await testEnv.wrap(tradeToken)({})
    await walletService.send(sellerAddress, sellOrder.payload.targetAddress, 0, { nativeTokens: [{ amount: HexHelper.fromBigInt256(bigInt(5)), id: token.mintingData?.tokenId! }] })
    mockWalletReturnValue(walletSpy, buyer, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.BUY })
    const buyOrder = await testEnv.wrap(tradeToken)({})
    await walletService.send(buyerAddress, buyOrder.payload.targetAddress, 10 * MIN_IOTA_AMOUNT)

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer)
    await wait(async () => {
      const orders = (await query.get()).docs.map(d => <TokenTradeOrder>d.data())
      return orders.length === 1 && orders[0].fulfilled === 5
    })

    const buy = <TokenTradeOrder>(await query.get()).docs[0].data()
    mockWalletReturnValue(walletSpy, buyer, { uid: buy.uid });
    await testEnv.wrap(cancelTradeOrder)({});

    const billPaymentsQuery = admin.firestore().collection(COL.TRANSACTION)
      .where('member', 'in', [seller, buyer]).where('type', '==', TransactionType.BILL_PAYMENT)
    await wait(async () => {
      const snap = await billPaymentsQuery.get()
      return snap.size === 4
    })

    const billPayments = (await billPaymentsQuery.get()).docs.map(d => d.data() as Transaction)
    const paymentToSeller = billPayments.find(bp => bp.payload.targetAddress === sellerAddress.bech32)!
    expect(paymentToSeller.payload.amount).toBe(4731800)
    expect(paymentToSeller.payload.sourceAddress).toBe(buyOrder.payload.targetAddress)
    expect(paymentToSeller.payload.storageReturn).toBeUndefined()

    const royaltyOnePayment = billPayments.find(bp => bp.payload.amount === 159300)!
    expect(royaltyOnePayment.payload.storageReturn.address).toBe(sellerAddress.bech32)
    expect(royaltyOnePayment.payload.sourceAddress).toBe(buyOrder.payload.targetAddress)
    expect(royaltyOnePayment.payload.storageReturn.amount).toBe(46800)

    const royaltyTwoPayment = billPayments.find(bp => bp.payload.amount === 59300)!
    expect(royaltyTwoPayment.payload.storageReturn.address).toBe(sellerAddress.bech32)
    expect(royaltyTwoPayment.payload.sourceAddress).toBe(buyOrder.payload.targetAddress)
    expect(royaltyTwoPayment.payload.storageReturn.amount).toBe(46800)

    const paymentToBuyer = billPayments.find(bp => bp.payload.targetAddress === buyerAddress.bech32)!
    expect(paymentToBuyer.payload.amount).toBe(49600)
    expect(paymentToBuyer.payload.nativeTokens[0].amount).toBe(5)
    expect(paymentToBuyer.payload.sourceAddress).toBe(sellOrder.payload.targetAddress)
    expect(paymentToBuyer.payload.storageDepositSourceAddress).toBe(buyOrder.payload.targetAddress)

    const sellerCreditSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller).where('type', '==', TransactionType.CREDIT).get()
    expect(sellerCreditSnap.size).toBe(1)
    const sellerCredit = sellerCreditSnap.docs.map(d => d.data() as Transaction)[0]
    expect(sellerCredit.payload.amount).toBe(49600)

    const buyerCreditSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer).where('type', '==', TransactionType.CREDIT).get()
    expect(buyerCreditSnap.size).toBe(1)
    const buyerCredit = buyerCreditSnap.docs.map(d => d.data() as Transaction)[0]
    expect(buyerCredit.payload.amount).toBe(5 * MIN_IOTA_AMOUNT)
  })

  it('Half fulfill sell and cancel it', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.SELL })
    const sellOrder = await testEnv.wrap(tradeToken)({})
    await walletService.send(sellerAddress, sellOrder.payload.targetAddress, 0, { nativeTokens: [{ amount: HexHelper.fromBigInt256(bigInt(10)), id: token.mintingData?.tokenId! }] })

    mockWalletReturnValue(walletSpy, buyer, { token: token.uid, count: 5, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.BUY })
    const buyOrder = await testEnv.wrap(tradeToken)({})
    await walletService.send(buyerAddress, buyOrder.payload.targetAddress, 5 * MIN_IOTA_AMOUNT)

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller)
    await wait(async () => {
      const orders = (await query.get()).docs.map(d => <TokenTradeOrder>d.data())
      return orders.length === 1 && orders[0].fulfilled === 5
    })

    const sell = <TokenTradeOrder>(await query.get()).docs[0].data()
    mockWalletReturnValue(walletSpy, seller, { uid: sell.uid });
    await testEnv.wrap(cancelTradeOrder)({});

    const billPaymentsQuery = admin.firestore().collection(COL.TRANSACTION)
      .where('member', 'in', [seller, buyer]).where('type', '==', TransactionType.BILL_PAYMENT)
    await wait(async () => {
      const snap = await billPaymentsQuery.get()
      return snap.size === 4
    })

    const billPayments = (await billPaymentsQuery.get()).docs.map(d => d.data() as Transaction)
    const paymentToSeller = billPayments.find(bp => bp.payload.targetAddress === sellerAddress.bech32)!
    expect(paymentToSeller.payload.amount).toBe(4731800)
    expect(paymentToSeller.payload.sourceAddress).toBe(buyOrder.payload.targetAddress)
    expect(paymentToSeller.payload.storageReturn).toBeUndefined()

    const royaltyOnePayment = billPayments.find(bp => bp.payload.amount === 159300)!
    expect(royaltyOnePayment.payload.storageReturn.address).toBe(sellerAddress.bech32)
    expect(royaltyOnePayment.payload.sourceAddress).toBe(buyOrder.payload.targetAddress)
    expect(royaltyOnePayment.payload.storageReturn.amount).toBe(46800)

    const royaltyTwoPayment = billPayments.find(bp => bp.payload.amount === 59300)!
    expect(royaltyTwoPayment.payload.storageReturn.address).toBe(sellerAddress.bech32)
    expect(royaltyTwoPayment.payload.sourceAddress).toBe(buyOrder.payload.targetAddress)
    expect(royaltyTwoPayment.payload.storageReturn.amount).toBe(46800)

    const paymentToBuyer = billPayments.find(bp => bp.payload.targetAddress === buyerAddress.bech32)!
    expect(paymentToBuyer.payload.amount).toBe(49600)
    expect(paymentToBuyer.payload.nativeTokens[0].amount).toBe(5)
    expect(paymentToBuyer.payload.sourceAddress).toBe(sellOrder.payload.targetAddress)
    expect(paymentToBuyer.payload.storageDepositSourceAddress).toBe(buyOrder.payload.targetAddress)

    const sellerCreditSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller).where('type', '==', TransactionType.CREDIT).get()
    expect(sellerCreditSnap.size).toBe(1)
    const sellerCredit = sellerCreditSnap.docs.map(d => d.data() as Transaction)[0]
    expect(sellerCredit.payload.amount).toBe(49600)
    expect(sellerCredit.payload.nativeTokens[0].amount).toBe(5)

    const buyerCreditSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer).where('type', '==', TransactionType.CREDIT).get()
    expect(buyerCreditSnap.size).toBe(0)
  })

  it('Should create sell order, not approved, but public', async () => {
    // Should throw at sell, not approved, not public
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false, public: false })
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.SELL })
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.token_not_approved.key)

    // Should throw at buy, not approved, not public
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false, public: false })
    mockWalletReturnValue(walletSpy, buyer, { token: token.uid, count: 5, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.BUY })
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.token_not_approved.key)

    // Should create sell order, not approved, but public
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false, public: true })
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.SELL })
    expect(await testEnv.wrap(tradeToken)({})).toBeDefined()

    // Should create buy order, not approved, but public'
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false, public: true })
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.BUY })
    expect(await testEnv.wrap(tradeToken)({})).toBeDefined()
  })

  it('Should create credit, order received different token', async () => {
    const dummyToken = await saveToken(space.uid, guardian, walletService, dummyTokenId)
    mockWalletReturnValue(walletSpy, seller, { token: dummyToken.uid, count: 10, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.SELL })
    const sellOrder = await testEnv.wrap(tradeToken)({})
    await walletService.send(sellerAddress, sellOrder.payload.targetAddress, 0, { nativeTokens: [{ amount: HexHelper.fromBigInt256(bigInt(10)), id: token.mintingData?.tokenId! }] })

    const query = admin.firestore().collection(COL.TRANSACTION).where('type', '==', TransactionType.CREDIT).where('member', '==', seller)
    await wait(async () => {
      const snap = await query.get()
      return snap.size === 1
    })
    const snap = await query.get()
    const credit = <Transaction>snap.docs[0].data()
    expect(credit.payload.amount).toBe(sellOrder.payload.amount)
    expect(credit.payload.nativeTokens[0].id).toBe(MINTED_TOKEN_ID)
    expect(credit.payload.nativeTokens[0].amount).toBe(10)
    const sellSnap = await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller).get()
    expect(sellSnap.docs.length).toBe(0)
  })

  afterAll(async () => {
    await listener.cancel()
  })

})

const saveToken = async (space: string, guardian: string, walletService: SmrWallet, tokenId = MINTED_TOKEN_ID) => {
  const vaultAddress = await walletService.getIotaAddressDetails(VAULT_MNEMONIC)
  await MnemonicService.store(vaultAddress.bech32, vaultAddress.mnemonic)
  const token = ({
    symbol: getRandomSymbol(),
    approved: true,
    updatedOn: serverTime(),
    createdOn: serverTime(),
    space,
    uid: wallet.getRandomEthAddress(),
    createdBy: guardian,
    name: 'MyToken',
    status: TokenStatus.MINTED,
    mintingData: {
      tokenId,
      network: Network.RMS,
      vaultAddress: vaultAddress.bech32
    },
    access: 0
  })
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token
}

const dummyTokenId = '0x080c409a8c0ffa795676e55f24e0223e5b48dbe2b1bc4314140333543b5e7e8d360100000000'

const VAULT_MNEMONIC = 'march fetch female armor you mirror minute winner staff empty rose wrap describe girl security maple recipe scan rebel couch field job liar snap'
const MINTED_TOKEN_ID = '0x087f3221adb3be9ef74a69595ef282b4ca47fd98b6bf1142e7d8f9f7b265efeedc0100000000'
