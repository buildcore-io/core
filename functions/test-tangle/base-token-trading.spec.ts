/* eslint-disable @typescript-eslint/no-explicit-any */
import { isEmpty } from "lodash";
import { MIN_IOTA_AMOUNT } from "../interfaces/config";
import { Member, Network, Token, TokenPurchase, TokenStatus, TokenTradeOrder, TokenTradeOrderType, Transaction, TransactionType } from "../interfaces/models";
import { COL } from "../interfaces/models/base";
import admin from "../src/admin.config";
import { createMember } from "../src/controls/member.control";
import { tradeToken } from "../src/controls/token-trading/token-trade.controller";
import { AddressDetails } from "../src/services/wallet/wallet";
import { serverTime } from "../src/utils/dateTime.utils";
import * as wallet from '../src/utils/wallet.utils';
import { createMember as createMemberTest, createRoyaltySpaces, createSpace, mockWalletReturnValue, wait } from "../test/controls/common";
import { testEnv } from "../test/set-up";
import { addValidatedAddress, awaitTransactionConfirmationsForToken } from "./common";
import { MilestoneListener } from "./db-sync.utils";
import { requestFundsFromFaucet } from "./faucet";

let walletSpy: any;
const sourceNetwork = Network.ATOI
const targetNetwork = Network.RMS

describe('Base token trading', () => {
  let listenerATOI: MilestoneListener
  let listenerRMS: MilestoneListener
  let seller: Member
  const sellerValidateAddress = {} as { [key: string]: AddressDetails }
  let buyer: Member
  const buyerValidateAddress = {} as { [key: string]: AddressDetails }
  let token: string

  beforeEach(async () => {
    await createRoyaltySpaces()
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    const guardian = await createMemberTest(walletSpy)
    const space = await createSpace(walletSpy, guardian)
    listenerATOI = new MilestoneListener(Network.ATOI)
    listenerRMS = new MilestoneListener(Network.RMS)

    const sellerId = wallet.getRandomEthAddress();
    mockWalletReturnValue(walletSpy, sellerId, {})
    await testEnv.wrap(createMember)(sellerId);
    sellerValidateAddress[Network.ATOI] = await addValidatedAddress(Network.ATOI, sellerId)
    sellerValidateAddress[Network.RMS] = await addValidatedAddress(Network.RMS, sellerId)
    seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sellerId}`).get()).data()

    const buyerId = wallet.getRandomEthAddress();
    mockWalletReturnValue(walletSpy, buyerId, {})
    await testEnv.wrap(createMember)(buyerId);
    buyerValidateAddress[Network.ATOI] = await addValidatedAddress(Network.ATOI, buyerId)
    buyerValidateAddress[Network.RMS] = await addValidatedAddress(Network.RMS, buyerId)
    buyer = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buyerId}`).get()).data()
    token = (await saveToken(space.uid, guardian, Network.ATOI)).uid
  })

  it('Should fulfill sell order', async () => {
    mockWalletReturnValue(walletSpy, seller.uid, { token, count: MIN_IOTA_AMOUNT, price: 2, type: TokenTradeOrderType.SELL })
    const sellOrder = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(sourceNetwork, sellOrder.payload.targetAddress, MIN_IOTA_AMOUNT)

    mockWalletReturnValue(walletSpy, buyer.uid, { token, count: MIN_IOTA_AMOUNT, price: 2, type: TokenTradeOrderType.BUY })
    const buyOrder = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(targetNetwork, buyOrder.payload.targetAddress, 2 * MIN_IOTA_AMOUNT)

    const sellQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller.uid)
    await wait(async () => {
      const snap = await sellQuery.get()
      return snap.size !== 0
    })
    const sell = <TokenTradeOrder>(await sellQuery.get()).docs[0].data()
    expect(sell.tokenStatus).toBe(TokenStatus.BASE)

    const buyQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer.uid)
    await wait(async () => {
      const snap = await buyQuery.get()
      return snap.size !== 0
    })
    const buy = <TokenTradeOrder>(await buyQuery.get()).docs[0].data()
    expect(buy.tokenStatus).toBe(TokenStatus.BASE)

    const purchaseQuery = admin.firestore().collection(COL.TOKEN_PURCHASE).where('sell', '==', sell.uid).where('buy', '==', buy.uid)
    await wait(async () => {
      const snap = await purchaseQuery.get()
      return snap.size !== 0
    })
    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data()

    expect(purchase.count).toBe(MIN_IOTA_AMOUNT)
    expect(purchase.price).toBe(2)
    expect(purchase.sourceNetwork).toBe(sourceNetwork)
    expect(purchase.targetNetwork).toBe(targetNetwork)
    expect(purchase.tokenStatus).toBe(TokenStatus.BASE)

    const sellerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller.uid).where('type', '==', TransactionType.BILL_PAYMENT).get()
    const sellerBillPayments = sellerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
    expect(sellerBillPayments.find(bp => bp.payload.amount === MIN_IOTA_AMOUNT && isEmpty(bp.payload.nativeTokens) && isEmpty(bp.payload.storageReturn))).toBeDefined()
    const sellerCreditnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller.uid).where('type', '==', TransactionType.CREDIT).get()
    expect(sellerCreditnap.size).toBe(0)

    const buyerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer.uid).where('type', '==', TransactionType.BILL_PAYMENT).get()
    const buyerBillPayments = buyerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
    expect(buyerBillPayments.length).toBe(3)
    expect(buyerBillPayments.find(bp => bp.payload.amount === 1856400 && isEmpty(bp.payload.nativeTokens) && isEmpty(bp.payload.storageReturn))).toBeDefined()
    expect(buyerBillPayments.find(bp => bp.payload.amount === 91800 && isEmpty(bp.payload.nativeTokens) && bp.payload.storageReturn.amount === 46800)).toBeDefined()
    expect(buyerBillPayments.find(bp => bp.payload.amount === 51800 && isEmpty(bp.payload.nativeTokens) && bp.payload.storageReturn.amount === 46800)).toBeDefined()
    const buyerCreditnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer.uid).where('type', '==', TransactionType.CREDIT).get()
    expect(buyerCreditnap.size).toBe(0)

    await awaitTransactionConfirmationsForToken(token)
  })

  it('Should fulfill buy order with half price', async () => {
    mockWalletReturnValue(walletSpy, seller.uid, { token, count: MIN_IOTA_AMOUNT, price: 1, type: TokenTradeOrderType.SELL })
    const sellOrder = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(sourceNetwork, sellOrder.payload.targetAddress, MIN_IOTA_AMOUNT)

    mockWalletReturnValue(walletSpy, buyer.uid, { token, count: MIN_IOTA_AMOUNT, price: 2, type: TokenTradeOrderType.BUY })
    const buyOrder = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(targetNetwork, buyOrder.payload.targetAddress, 2 * MIN_IOTA_AMOUNT)

    const sellQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller.uid)
    await wait(async () => {
      const snap = await sellQuery.get()
      return snap.size !== 0
    })
    const sell = <TokenTradeOrder>(await sellQuery.get()).docs[0].data()

    const buyQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer.uid)
    await wait(async () => {
      const snap = await buyQuery.get()
      return snap.size !== 0
    })
    let buy = <TokenTradeOrder>(await buyQuery.get()).docs[0].data()

    const purchaseQuery = admin.firestore().collection(COL.TOKEN_PURCHASE).where('sell', '==', sell.uid).where('buy', '==', buy.uid)
    await wait(async () => {
      const snap = await purchaseQuery.get()
      return snap.size !== 0
    })
    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data()

    expect(purchase.count).toBe(MIN_IOTA_AMOUNT)
    expect(purchase.price).toBe(1)
    expect(purchase.sourceNetwork).toBe(sourceNetwork)
    expect(purchase.targetNetwork).toBe(targetNetwork)

    const sellerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller.uid).where('type', '==', TransactionType.BILL_PAYMENT).get()
    const sellerBillPayments = sellerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
    expect(sellerBillPayments.find(bp => bp.payload.amount === MIN_IOTA_AMOUNT && isEmpty(bp.payload.nativeTokens) && isEmpty(bp.payload.storageReturn))).toBeDefined()
    const sellerCreditnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller.uid).where('type', '==', TransactionType.CREDIT).get()
    const sellerCredit = sellerCreditnap.docs.map(d => d.data() as Transaction)
    expect(sellerCredit.length).toBe(0)

    const buyerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer.uid).where('type', '==', TransactionType.BILL_PAYMENT).get()
    const buyerBillPayments = buyerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
    expect(buyerBillPayments.length).toBe(3)
    expect(buyerBillPayments.find(bp => bp.payload.amount === 881400 && isEmpty(bp.payload.nativeTokens) && isEmpty(bp.payload.storageReturn))).toBeDefined()
    expect(buyerBillPayments.find(bp => bp.payload.amount === 69300 && isEmpty(bp.payload.nativeTokens) && bp.payload.storageReturn.amount === 46800)).toBeDefined()
    expect(buyerBillPayments.find(bp => bp.payload.amount === 49300 && isEmpty(bp.payload.nativeTokens) && bp.payload.storageReturn.amount === 46800)).toBeDefined()
    const buyerCreditnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer.uid).where('type', '==', TransactionType.CREDIT).get()
    expect(buyerCreditnap.size).toBe(1)
    expect(buyerCreditnap.docs[0].data()?.payload.amount).toBe(MIN_IOTA_AMOUNT)
    buy = <TokenTradeOrder>(await buyQuery.get()).docs[0].data()
    expect(buy.creditTransactionId).toBe(buyerCreditnap.docs[0].id)

    await awaitTransactionConfirmationsForToken(token)
  })

  it('Should fulfill buy with two sells', async () => {
    mockWalletReturnValue(walletSpy, seller.uid, { token, count: MIN_IOTA_AMOUNT, price: 1, type: TokenTradeOrderType.SELL })
    const sellOrder = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(sourceNetwork, sellOrder.payload.targetAddress, MIN_IOTA_AMOUNT)

    mockWalletReturnValue(walletSpy, seller.uid, { token, count: MIN_IOTA_AMOUNT, price: 1, type: TokenTradeOrderType.SELL })
    const sellOrder2 = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(sourceNetwork, sellOrder2.payload.targetAddress, MIN_IOTA_AMOUNT)

    mockWalletReturnValue(walletSpy, buyer.uid, { token, count: 2 * MIN_IOTA_AMOUNT, price: 1, type: TokenTradeOrderType.BUY })
    const buyOrder = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(targetNetwork, buyOrder.payload.targetAddress, 2 * MIN_IOTA_AMOUNT)

    const sellQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller.uid)
    await wait(async () => {
      const snap = await sellQuery.get()
      return snap.size === 2
    })

    const buyQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer.uid)
    await wait(async () => {
      const snap = await buyQuery.get()
      return snap.size === 1
    })
    const buy = <TokenTradeOrder>(await buyQuery.get()).docs[0].data()

    const purchaseQuery = admin.firestore().collection(COL.TOKEN_PURCHASE).where('buy', '==', buy.uid)
    await wait(async () => {
      const snap = await purchaseQuery.get()
      return snap.size === 2
    })

    const sellerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller.uid).where('type', '==', TransactionType.BILL_PAYMENT).get()
    const sellerBillPayments = sellerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
    expect(sellerBillPayments.filter(p => p.payload.amount === MIN_IOTA_AMOUNT).length).toBe(2)
    const sellerCreditnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller.uid).where('type', '==', TransactionType.CREDIT).get()
    expect(sellerCreditnap.size).toBe(0)

    const buyerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer.uid).where('type', '==', TransactionType.BILL_PAYMENT).get()
    const buyerBillPayments = buyerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
    expect(buyerBillPayments.length).toBe(6)
    expect(buyerBillPayments.filter(bp => bp.payload.amount === 881400).length).toBe(2)
    expect(buyerBillPayments.filter(bp => bp.payload.amount === 69300 && bp.payload.storageReturn.amount === 46800).length).toBe(2)
    expect(buyerBillPayments.filter(bp => bp.payload.amount === 49300 && bp.payload.storageReturn.amount === 46800).length).toBe(2)
    const buyerCreditnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer.uid).where('type', '==', TransactionType.CREDIT).get()
    expect(buyerCreditnap.size).toBe(0)

    await awaitTransactionConfirmationsForToken(token)
  })

  it('Should fulfill sell with two buys', async () => {
    mockWalletReturnValue(walletSpy, seller.uid, { token, count: 2 * MIN_IOTA_AMOUNT, price: 1, type: TokenTradeOrderType.SELL })
    const sellOrder = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(sourceNetwork, sellOrder.payload.targetAddress, 2 * MIN_IOTA_AMOUNT)

    mockWalletReturnValue(walletSpy, buyer.uid, { token, count: MIN_IOTA_AMOUNT, price: 1, type: TokenTradeOrderType.BUY })
    const buyOrder = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(targetNetwork, buyOrder.payload.targetAddress, MIN_IOTA_AMOUNT)

    mockWalletReturnValue(walletSpy, buyer.uid, { token, count: MIN_IOTA_AMOUNT, price: 1, type: TokenTradeOrderType.BUY })
    const buyOrder2 = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(targetNetwork, buyOrder2.payload.targetAddress, MIN_IOTA_AMOUNT)

    const sellQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller.uid)
    await wait(async () => {
      const snap = await sellQuery.get()
      return snap.size === 1
    })
    const sell = <TokenTradeOrder>(await sellQuery.get()).docs[0].data()

    const buyQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer.uid)
    await wait(async () => {
      const snap = await buyQuery.get()
      return snap.size === 2
    })

    const purchaseQuery = admin.firestore().collection(COL.TOKEN_PURCHASE).where('sell', '==', sell.uid)
    await wait(async () => {
      const snap = await purchaseQuery.get()
      return snap.size === 2
    })

    const sellerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller.uid).where('type', '==', TransactionType.BILL_PAYMENT).get()
    const sellerBillPayments = sellerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
    expect(sellerBillPayments.filter(p => p.payload.amount === MIN_IOTA_AMOUNT).length).toBe(2)
    const sellerCreditnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller.uid).where('type', '==', TransactionType.CREDIT).get()
    expect(sellerCreditnap.size).toBe(0)

    const buyerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer.uid).where('type', '==', TransactionType.BILL_PAYMENT).get()
    const buyerBillPayments = buyerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
    expect(buyerBillPayments.length).toBe(6)
    expect(buyerBillPayments.filter(bp => bp.payload.amount === 881400).length).toBe(2)
    expect(buyerBillPayments.filter(bp => bp.payload.amount === 69300 && bp.payload.storageReturn.amount === 46800).length).toBe(2)
    expect(buyerBillPayments.filter(bp => bp.payload.amount === 49300 && bp.payload.storageReturn.amount === 46800).length).toBe(2)
    const buyerCreditnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer.uid).where('type', '==', TransactionType.CREDIT).get()
    expect(buyerCreditnap.size).toBe(0)

    await awaitTransactionConfirmationsForToken(token)
  })

  it('Should fulfill buy with lowest sell', async () => {
    mockWalletReturnValue(walletSpy, seller.uid, { token, count: MIN_IOTA_AMOUNT, price: 2, type: TokenTradeOrderType.SELL })
    const sellOrder = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(sourceNetwork, sellOrder.payload.targetAddress, sellOrder.payload.amount)

    mockWalletReturnValue(walletSpy, seller.uid, { token, count: MIN_IOTA_AMOUNT, price: 1, type: TokenTradeOrderType.SELL })
    const sellOrder2 = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(sourceNetwork, sellOrder2.payload.targetAddress, sellOrder2.payload.amount)

    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller.uid).get()
      return snap.size === 2
    })

    mockWalletReturnValue(walletSpy, buyer.uid, { token, count: MIN_IOTA_AMOUNT, price: 2, type: TokenTradeOrderType.BUY })
    const buyOrder = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(targetNetwork, buyOrder.payload.targetAddress, buyOrder.payload.amount)

    const purchaseQuery = admin.firestore().collection(COL.TOKEN_PURCHASE).where('token', '==', token)
    await wait(async () => {
      const snap = await purchaseQuery.get()
      return snap.size === 1
    })
    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data()

    expect(purchase.count).toBe(MIN_IOTA_AMOUNT)
    expect(purchase.price).toBe(1)
    expect(purchase.sourceNetwork).toBe(sourceNetwork)
    expect(purchase.targetNetwork).toBe(targetNetwork)

    await awaitTransactionConfirmationsForToken(token)
  })

  it('Should fulfill sell with highest buy', async () => {
    mockWalletReturnValue(walletSpy, buyer.uid, { token, count: MIN_IOTA_AMOUNT, price: 1, type: TokenTradeOrderType.BUY })
    const buyOrder = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(targetNetwork, buyOrder.payload.targetAddress, buyOrder.payload.amount)

    mockWalletReturnValue(walletSpy, buyer.uid, { token, count: MIN_IOTA_AMOUNT, price: 2, type: TokenTradeOrderType.BUY })
    const buyOrder2 = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(targetNetwork, buyOrder2.payload.targetAddress, buyOrder2.payload.amount)

    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer.uid).get()
      return snap.size === 2
    })

    mockWalletReturnValue(walletSpy, seller.uid, { token, count: MIN_IOTA_AMOUNT, price: 1, type: TokenTradeOrderType.SELL })
    const sellOrder = await testEnv.wrap(tradeToken)({})
    await requestFundsFromFaucet(sourceNetwork, sellOrder.payload.targetAddress, sellOrder.payload.amount)

    const purchaseQuery = admin.firestore().collection(COL.TOKEN_PURCHASE).where('token', '==', token)
    await wait(async () => {
      const snap = await purchaseQuery.get()
      return snap.size === 1
    })
    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data()

    expect(purchase.count).toBe(MIN_IOTA_AMOUNT)
    expect(purchase.price).toBe(2)
    expect(purchase.sourceNetwork).toBe(sourceNetwork)
    expect(purchase.targetNetwork).toBe(targetNetwork)

    await awaitTransactionConfirmationsForToken(token)
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
