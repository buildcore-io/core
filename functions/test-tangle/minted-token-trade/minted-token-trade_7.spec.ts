/* eslint-disable @typescript-eslint/no-explicit-any */

import { MIN_IOTA_AMOUNT } from "../../interfaces/config"
import { TokenTradeOrder, Transaction, TransactionType } from "../../interfaces/models"
import { COL } from "../../interfaces/models/base"
import admin from "../../src/admin.config"
import { cancelTradeOrder } from "../../src/controls/token-trading/token-trade-cancel.controller"
import { mockWalletReturnValue, wait } from "../../test/controls/common"
import { testEnv } from "../../test/set-up"
import { awaitTransactionConfirmationsForToken } from "../common"
import { Helper } from "./Helper"

describe('Token minting', () => {
  const helper = new Helper()

  beforeAll(async () => {
    await helper.berforeAll()
  })

  beforeEach(async () => {
    await helper.beforeEach()
  })

  it('Half fulfill sell and cancel it', async () => {
    const sellOrder = await helper.createSellTradeOrder()
    const buyOrder = await helper.createBuyOrder(5, MIN_IOTA_AMOUNT)

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', helper.seller)
    await wait(async () => {
      const orders = (await query.get()).docs.map(d => <TokenTradeOrder>d.data())
      return orders.length === 1 && orders[0].fulfilled === 5
    })
    await awaitTransactionConfirmationsForToken(helper.token!.uid)

    const sell = <TokenTradeOrder>(await query.get()).docs[0].data()
    mockWalletReturnValue(helper.walletSpy, helper.seller!, { uid: sell.uid });
    await testEnv.wrap(cancelTradeOrder)({});

    const billPaymentsQuery = admin.firestore().collection(COL.TRANSACTION)
      .where('member', 'in', [helper.seller, helper.buyer]).where('type', '==', TransactionType.BILL_PAYMENT)
    await wait(async () => {
      const snap = await billPaymentsQuery.get()
      return snap.size === 4
    })

    const billPayments = (await billPaymentsQuery.get()).docs.map(d => d.data() as Transaction)
    const paymentToSeller = billPayments.find(bp => bp.payload.targetAddress === helper.sellerAddress!.bech32)!
    expect(paymentToSeller.payload.amount).toBe(4728200)
    expect(paymentToSeller.payload.sourceAddress).toBe(buyOrder.payload.targetAddress)
    expect(paymentToSeller.payload.storageReturn).toBeUndefined()

    const royaltyOnePayment = billPayments.find(bp => bp.payload.amount === 160500)!
    expect(royaltyOnePayment.payload.storageReturn.address).toBe(helper.sellerAddress!.bech32)
    expect(royaltyOnePayment.payload.sourceAddress).toBe(buyOrder.payload.targetAddress)
    expect(royaltyOnePayment.payload.storageReturn.amount).toBe(48000)

    const royaltyTwoPayment = billPayments.find(bp => bp.payload.amount === 60500)!
    expect(royaltyTwoPayment.payload.storageReturn.address).toBe(helper.sellerAddress!.bech32)
    expect(royaltyTwoPayment.payload.sourceAddress).toBe(buyOrder.payload.targetAddress)
    expect(royaltyTwoPayment.payload.storageReturn.amount).toBe(48000)

    const paymentToBuyer = billPayments.find(bp => bp.payload.targetAddress === helper.buyerAddress!.bech32)!
    expect(paymentToBuyer.payload.amount).toBe(50800)
    expect(paymentToBuyer.payload.nativeTokens[0].amount).toBe(5)
    expect(paymentToBuyer.payload.sourceAddress).toBe(sellOrder.payload.targetAddress)
    expect(paymentToBuyer.payload.storageDepositSourceAddress).toBe(buyOrder.payload.targetAddress)

    const sellerCreditSnap = await admin.firestore().collection(COL.TRANSACTION)
      .where('member', '==', helper.seller)
      .where('type', '==', TransactionType.CREDIT)
      .get()
    expect(sellerCreditSnap.size).toBe(1)
    const sellerCredit = sellerCreditSnap.docs.map(d => d.data() as Transaction)[0]
    expect(sellerCredit.payload.amount).toBe(50800)
    expect(sellerCredit.payload.nativeTokens[0].amount).toBe(5)

    const buyerCreditSnap = await admin.firestore().collection(COL.TRANSACTION)
      .where('member', '==', helper.buyer)
      .where('type', '==', TransactionType.CREDIT)
      .get()
    expect(buyerCreditSnap.size).toBe(0)

    await awaitTransactionConfirmationsForToken(helper.token!.uid)
  })

  afterAll(async () => {
    await helper.listener!.cancel()
  })

})
