/* eslint-disable @typescript-eslint/no-explicit-any */
import { isEmpty } from "lodash";
import { MIN_IOTA_AMOUNT } from "../interfaces/config";
import { Member, Network, Token, TokenPurchase, TokenStatus, TokenTradeOrder, Transaction, TransactionType } from "../interfaces/models";
import { COL } from "../interfaces/models/base";
import admin from "../src/admin.config";
import { createMember } from "../src/controls/member.control";
import { tradeBaseTokenOrder } from "../src/controls/token-trading/trade-base-token.controller";
import { AddressDetails, WalletService } from "../src/services/wallet/wallet";
import { serverTime } from "../src/utils/dateTime.utils";
import * as wallet from '../src/utils/wallet.utils';
import { createMember as createMemberTest, createRoyaltySpaces, createSpace, mockWalletReturnValue, wait } from "../test/controls/common";
import { testEnv } from "../test/set-up";
import { addValidatedAddress } from "./common";
import { MilestoneListener } from "./db-sync.utils";
import { requestFundsFromFaucet } from "./faucet";

let walletSpy: any;
const sourceNetwork = Network.RMS
const targetNetwork = Network.ATOI
const sourceWallet = WalletService.newWallet(sourceNetwork)
const targetWallet = WalletService.newWallet(targetNetwork)

describe('Base token trading', () => {
  let listenerATOI: MilestoneListener
  let listenerRMS: MilestoneListener
  let seller: Member
  const sellerValidateAddress = {} as { [key: string]: AddressDetails }
  let buyer: Member
  const buyerValidateAddress = {} as { [key: string]: AddressDetails }

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
    await saveToken(space.uid, guardian, Network.ATOI)
  })

  it('Should fulfill sell order', async () => {
    await requestFundsFromFaucet(sourceNetwork, sellerValidateAddress[sourceNetwork].bech32, 10 * MIN_IOTA_AMOUNT)
    mockWalletReturnValue(walletSpy, seller.uid, { network: sourceNetwork, count: 10, price: MIN_IOTA_AMOUNT })
    const sellOrder = await testEnv.wrap(tradeBaseTokenOrder)({})
    await sourceWallet.send(sellerValidateAddress[sourceNetwork], sellOrder.payload.targetAddress, 10 * MIN_IOTA_AMOUNT)

    await requestFundsFromFaucet(targetNetwork, buyerValidateAddress[targetNetwork].bech32, 10 * MIN_IOTA_AMOUNT)
    mockWalletReturnValue(walletSpy, buyer.uid, { network: targetNetwork, count: 10, price: MIN_IOTA_AMOUNT })
    const buyOrder = await testEnv.wrap(tradeBaseTokenOrder)({})
    await targetWallet.send(buyerValidateAddress[targetNetwork], buyOrder.payload.targetAddress, 10 * MIN_IOTA_AMOUNT)

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
    const buy = <TokenTradeOrder>(await buyQuery.get()).docs[0].data()

    const purchaseQuery = admin.firestore().collection(COL.TOKEN_PURCHASE).where('sell', '==', sell.uid).where('buy', '==', buy.uid)
    await wait(async () => {
      const snap = await purchaseQuery.get()
      return snap.size !== 0
    })
    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data()

    expect(purchase.count).toBe(10)
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT)
    expect(purchase.sourceNetwork).toBe(sourceNetwork)
    expect(purchase.targetNetwork).toBe(targetNetwork)

    const sellerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller.uid).where('type', '==', TransactionType.BILL_PAYMENT).get()
    const sellerBillPayments = sellerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
    expect(sellerBillPayments.length).toBe(3)
    expect(sellerBillPayments.find(bp => bp.payload.amount === 9656400 && isEmpty(bp.payload.nativeToken) && isEmpty(bp.payload.storageReturn))).toBeDefined()
    expect(sellerBillPayments.find(bp => bp.payload.amount === 271800 && isEmpty(bp.payload.nativeToken) && bp.payload.storageReturn.amount === 46800)).toBeDefined()
    expect(sellerBillPayments.find(bp => bp.payload.amount === 71800 && isEmpty(bp.payload.nativeToken) && bp.payload.storageReturn.amount === 46800)).toBeDefined()
    const sellerCreditnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller.uid).where('type', '==', TransactionType.CREDIT).get()
    expect(sellerCreditnap.size).toBe(0)

    const buyerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer.uid).where('type', '==', TransactionType.BILL_PAYMENT).get()
    const buyerBillPayments = buyerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
    expect(buyerBillPayments.find(bp => bp.payload.amount === 10 * MIN_IOTA_AMOUNT && isEmpty(bp.payload.nativeToken) && isEmpty(bp.payload.storageReturn)))
    const buyerCreditnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer.uid).where('type', '==', TransactionType.CREDIT).get()
    expect(buyerCreditnap.size).toBe(0)
  })

  it('Should fulfill buy order with half price', async () => {
    await requestFundsFromFaucet(sourceNetwork, sellerValidateAddress[sourceNetwork].bech32, 10 * MIN_IOTA_AMOUNT)
    mockWalletReturnValue(walletSpy, seller.uid, { network: sourceNetwork, count: 10, price: MIN_IOTA_AMOUNT })
    const sellOrder = await testEnv.wrap(tradeBaseTokenOrder)({})
    await sourceWallet.send(sellerValidateAddress[sourceNetwork], sellOrder.payload.targetAddress, 10 * MIN_IOTA_AMOUNT)

    await requestFundsFromFaucet(targetNetwork, buyerValidateAddress[targetNetwork].bech32, 20 * MIN_IOTA_AMOUNT)
    mockWalletReturnValue(walletSpy, buyer.uid, { network: targetNetwork, count: 10, price: 2 * MIN_IOTA_AMOUNT })
    const buyOrder = await testEnv.wrap(tradeBaseTokenOrder)({})
    await targetWallet.send(buyerValidateAddress[targetNetwork], buyOrder.payload.targetAddress, 20 * MIN_IOTA_AMOUNT)

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
    const buy = <TokenTradeOrder>(await buyQuery.get()).docs[0].data()

    const purchaseQuery = admin.firestore().collection(COL.TOKEN_PURCHASE).where('sell', '==', sell.uid).where('buy', '==', buy.uid)
    await wait(async () => {
      const snap = await purchaseQuery.get()
      return snap.size !== 0
    })
    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data()

    expect(purchase.count).toBe(10)
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT)
    expect(purchase.sourceNetwork).toBe(sourceNetwork)
    expect(purchase.targetNetwork).toBe(targetNetwork)

    const sellerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller.uid).where('type', '==', TransactionType.BILL_PAYMENT).get()
    const sellerBillPayments = sellerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
    expect(sellerBillPayments.length).toBe(3)
    expect(sellerBillPayments.find(bp => bp.payload.amount === 9656400 && isEmpty(bp.payload.nativeToken) && isEmpty(bp.payload.storageReturn))).toBeDefined()
    expect(sellerBillPayments.find(bp => bp.payload.amount === 271800 && isEmpty(bp.payload.nativeToken) && bp.payload.storageReturn.amount === 46800)).toBeDefined()
    expect(sellerBillPayments.find(bp => bp.payload.amount === 71800 && isEmpty(bp.payload.nativeToken) && bp.payload.storageReturn.amount === 46800)).toBeDefined()
    const sellerCreditnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller.uid).where('type', '==', TransactionType.CREDIT).get()
    expect(sellerCreditnap.size).toBe(0)

    const buyerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer.uid).where('type', '==', TransactionType.BILL_PAYMENT).get()
    const buyerBillPayments = buyerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
    expect(buyerBillPayments.find(bp => bp.payload.amount === 10 * MIN_IOTA_AMOUNT && isEmpty(bp.payload.nativeToken) && isEmpty(bp.payload.storageReturn)))
    const buyerCreditnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buyer.uid).where('type', '==', TransactionType.CREDIT).get()
    const buyerCredit = buyerCreditnap.docs.map(d => d.data() as Transaction)
    expect(buyerCredit.length).toBe(1)
    expect(buyerCredit.find(c => c.payload.amount === 10 * MIN_IOTA_AMOUNT && isEmpty(c.payload.nativeToken) && isEmpty(c.payload.storageReturn))).toBeDefined()
  })

  it('Should fulfill buy with two sells', async () => {
    await requestFundsFromFaucet(sourceNetwork, sellerValidateAddress[sourceNetwork].bech32, 20 * MIN_IOTA_AMOUNT)
    mockWalletReturnValue(walletSpy, seller.uid, { network: sourceNetwork, count: 10, price: MIN_IOTA_AMOUNT })
    const sellPromises = Array.from(Array(2)).map(async (_, index) => {
      const sellQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller.uid)
      await wait(async () => {
        const snap = await sellQuery.get()
        return snap.size !== index
      })
      const sellOrder = await testEnv.wrap(tradeBaseTokenOrder)({})
      await sourceWallet.send(sellerValidateAddress[sourceNetwork], sellOrder.payload.targetAddress, 10 * MIN_IOTA_AMOUNT)
    })
    await Promise.all(sellPromises)
    await requestFundsFromFaucet(targetNetwork, buyerValidateAddress[targetNetwork].bech32, 20 * MIN_IOTA_AMOUNT)
    mockWalletReturnValue(walletSpy, buyer.uid, { network: targetNetwork, count: 20, price: MIN_IOTA_AMOUNT })
    const buyOrder = await testEnv.wrap(tradeBaseTokenOrder)({})
    await targetWallet.send(buyerValidateAddress[targetNetwork], buyOrder.payload.targetAddress, 20 * MIN_IOTA_AMOUNT)

    const buyQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer.uid)
    await wait(async () => {
      const buy = <TokenTradeOrder | undefined>(await buyQuery.get()).docs[0]?.data()
      return buy !== undefined && buy.count === buy.fulfilled
    })

    const sellerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller.uid).where('type', '==', TransactionType.BILL_PAYMENT).get()
    const sellerBillPayments = sellerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
    expect(sellerBillPayments.length).toBe(6)

    const total = sellerBillPayments.reduce((acc, act) => act.ignoreWallet ? acc : acc + act.payload.amount, 0)
    expect(total).toBe(20 * MIN_IOTA_AMOUNT)
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
