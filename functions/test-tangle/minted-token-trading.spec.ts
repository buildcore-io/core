/* eslint-disable @typescript-eslint/no-explicit-any */

import { HexHelper } from '@iota/util.js-next';
import bigInt from 'big-integer';
import { MIN_IOTA_AMOUNT } from '../interfaces/config';
import { WenError } from '../interfaces/errors';
import { Member, Network, Space, Transaction, TransactionType } from '../interfaces/models';
import { COL } from '../interfaces/models/base';
import { Token, TokenPurchase, TokenStatus, TokenTradeOrder, TokenTradeOrderType } from '../interfaces/models/token';
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
import { awaitTransactionConfirmationsForToken } from './common';
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
    listener = new MilestoneListener(network)
  })

  beforeEach(async () => {
    guardian = await createMember(walletSpy)
    space = await createSpace(walletSpy, guardian)
    token = await saveToken(space.uid, guardian, walletService) as Token

    seller = await createMember(walletSpy)
    const sellerDoc = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${seller}`).get()).data()
    sellerAddress = await walletService.getAddressDetails(getAddress(sellerDoc, network))
    await requestFundsFromFaucet(network, sellerAddress.bech32, 20 * MIN_IOTA_AMOUNT)
    await requestMintedTokenFromFaucet(walletService, sellerAddress, token.mintingData?.tokenId!, VAULT_MNEMONIC)

    buyer = await createMember(walletSpy)
    const buyerDoc = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buyer}`).get()).data()
    buyerAddress = await walletService.getAddressDetails(getAddress(buyerDoc, network))
  })


  const createSellTradeOrder = async (count = 10, price = MIN_IOTA_AMOUNT) => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, count, price, type: TokenTradeOrderType.SELL })
    const sellOrder: Transaction = await testEnv.wrap(tradeToken)({})
    await walletService.send(sellerAddress, sellOrder.payload.targetAddress, 0, {
      nativeTokens: [{ amount: HexHelper.fromBigInt256(bigInt(count)), id: token.mintingData?.tokenId! }]
    })
    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TOKEN_MARKET).where('orderTransactionId', '==', sellOrder.uid).get()
      return snap.size === 1
    })
    return sellOrder
  }

  const createBuyOrder = async (count = 10, price = MIN_IOTA_AMOUNT) => {
    mockWalletReturnValue(walletSpy, buyer, { token: token.uid, count, price, type: TokenTradeOrderType.BUY })
    const buyOrder: Transaction = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(network, buyOrder.payload.targetAddress, buyOrder.payload.amount)
    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TOKEN_MARKET).where('orderTransactionId', '==', buyOrder.uid).get()
      return snap.size === 1
    })
    return buyOrder
  }

  it.each([false, true])('Fulfill trade with same price', async (saveBuyFirst: boolean) => {
    let buyOrder: any
    let sellOrder: any
    if (saveBuyFirst) {
      buyOrder = await createBuyOrder()
      sellOrder = await createSellTradeOrder()
    } else {
      sellOrder = await createSellTradeOrder()
      buyOrder = await createBuyOrder()
    }

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

    const purchase = (await admin.firestore().collection(COL.TOKEN_PURCHASE).where('token', '==', token.uid).get()).docs[0].data() as TokenPurchase
    expect(purchase.triggeredBy).toBe(saveBuyFirst ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY)
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT)
    expect(purchase.count).toBe(10)
    await awaitTransactionConfirmationsForToken(token.uid)
  })

  it('Fulfill buy with half price', async () => {
    const sellOrder = await createSellTradeOrder()
    const buyOrder = await createBuyOrder(10, 2 * MIN_IOTA_AMOUNT)

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

    await awaitTransactionConfirmationsForToken(token.uid)
  })

  it('Fulfill sell with two buys', async () => {
    await createBuyOrder(5, MIN_IOTA_AMOUNT)
    await createBuyOrder(5, MIN_IOTA_AMOUNT)
    await createSellTradeOrder()

    await wait(async () => {
      const orders = (await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get()).docs.map(d => <TokenTradeOrder>d.data())
      const fulfilled = orders.filter(o => o.count === o.fulfilled)
      return fulfilled.length === orders.length
    })

    await awaitTransactionConfirmationsForToken(token.uid)
  })

  it('Create and cancel sell', async () => {
    await createSellTradeOrder()

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller)
    const sell = <TokenTradeOrder>(await query.get()).docs[0].data()
    mockWalletReturnValue(walletSpy, seller, { uid: sell.uid });
    await testEnv.wrap(cancelTradeOrder)({});

    const sellerCreditSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller).where('type', '==', TransactionType.CREDIT).get()
    expect(sellerCreditSnap.size).toBe(1)
    const sellerCredit = sellerCreditSnap.docs[0].data() as Transaction
    expect(sellerCredit.payload.amount).toBe(49600)
    expect(sellerCredit.payload.nativeTokens[0].amount).toBe(10)

    await awaitTransactionConfirmationsForToken(token.uid)
  })

  it('Create and cancel buy', async () => {
    await createBuyOrder()

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer)
    const buy = <TokenTradeOrder>(await query.get()).docs[0].data()
    mockWalletReturnValue(walletSpy, buyer, { uid: buy.uid });
    await testEnv.wrap(cancelTradeOrder)({});

    const buyerCreditnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer).where('type', '==', TransactionType.CREDIT).get()
    expect(buyerCreditnap.size).toBe(1)
    expect(buyerCreditnap.docs[0].data()?.payload?.amount).toBe(10 * MIN_IOTA_AMOUNT)

    await awaitTransactionConfirmationsForToken(token.uid)
  })

  it('Half fulfill buy and cancel it', async () => {
    const sellOrder = await createSellTradeOrder(5, MIN_IOTA_AMOUNT)
    const buyOrder = await createBuyOrder()

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

    await awaitTransactionConfirmationsForToken(token.uid)
  })

  it('Half fulfill sell and cancel it', async () => {
    const sellOrder = await createSellTradeOrder()
    const buyOrder = await createBuyOrder(5, MIN_IOTA_AMOUNT)

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller)
    await wait(async () => {
      const orders = (await query.get()).docs.map(d => <TokenTradeOrder>d.data())
      return orders.length === 1 && orders[0].fulfilled === 5
    })
    await awaitTransactionConfirmationsForToken(token.uid)

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

    await awaitTransactionConfirmationsForToken(token.uid)
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

    await awaitTransactionConfirmationsForToken(token.uid)
  })

  it('Should create credit, order received different token', async () => {
    const dummyToken = await saveToken(space.uid, guardian, walletService, dummyTokenId)
    mockWalletReturnValue(walletSpy, seller, { token: dummyToken.uid, count: 10, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.SELL })
    const sellOrder = await testEnv.wrap(tradeToken)({})
    await walletService.send(sellerAddress, sellOrder.payload.targetAddress, 0, {
      nativeTokens: [{ amount: HexHelper.fromBigInt256(bigInt(10)), id: token.mintingData?.tokenId! }]
    })

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

    await awaitTransactionConfirmationsForToken(token.uid)
  })

  it('Fulfill buy with lowest sell', async () => {
    await createSellTradeOrder(5, MIN_IOTA_AMOUNT)
    await createSellTradeOrder(5, 2 * MIN_IOTA_AMOUNT)
    await createBuyOrder(5, 2 * MIN_IOTA_AMOUNT)

    const purchaseQuery = admin.firestore().collection(COL.TOKEN_PURCHASE).where('token', '==', token.uid)
    await wait(async () => {
      const snap = await purchaseQuery.get()
      return snap.size === 1
    })
    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data()

    expect(purchase.count).toBe(5)
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT)

    await awaitTransactionConfirmationsForToken(token.uid)
  })

  it('Fulfill sell with highest buy', async () => {
    await createBuyOrder(5, MIN_IOTA_AMOUNT)
    await createBuyOrder(5, 2 * MIN_IOTA_AMOUNT)
    await createSellTradeOrder(5, MIN_IOTA_AMOUNT)

    const purchaseQuery = admin.firestore().collection(COL.TOKEN_PURCHASE).where('token', '==', token.uid)
    await wait(async () => {
      const snap = await purchaseQuery.get()
      return snap.size === 1
    })
    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data()

    expect(purchase.count).toBe(5)
    expect(purchase.price).toBe(2 * MIN_IOTA_AMOUNT)

    await awaitTransactionConfirmationsForToken(token.uid)
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

const VAULT_MNEMONIC = 'protect bracket walk twelve amount search stone call dress decade arrow flower tray enroll smart day oil twist lumber write denial canvas crunch select'
const MINTED_TOKEN_ID = '0x080070e0465a4f4ccd4a151e74426379b1fdf41f15aa14188ebed33e60aef9dea90100000000'
