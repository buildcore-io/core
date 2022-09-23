/* eslint-disable @typescript-eslint/no-explicit-any */

import { MIN_IOTA_AMOUNT } from "../../interfaces/config"
import { Network, TokenTradeOrder, TokenTradeOrderStatus, TokenTradeOrderType } from "../../interfaces/models"
import { COL } from "../../interfaces/models/base"
import admin from "../../src/admin.config"
import { tradeToken } from "../../src/controls/token-trading/token-trade.controller"
import { mockWalletReturnValue, wait } from "../../test/controls/common"
import { testEnv } from "../../test/set-up"
import { awaitTransactionConfirmationsForToken } from "../common"
import { requestFundsForManyFromFaucet } from "../faucet"
import { Helper } from "./Helper"

describe('Token minting', () => {
  const helper = new Helper()

  beforeAll(async () => {
    await helper.berforeAll()
  })

  beforeEach(async () => {
    await helper.beforeEach()
  })

  it('Half fulfill many buys with sell', async () => {
    const count = 15
    mockWalletReturnValue(helper.walletSpy, helper.buyer!, { token: helper.token!.uid, count: 1, price: MIN_IOTA_AMOUNT, type: TokenTradeOrderType.BUY })
    const promises = Array.from(Array(count)).map(() => testEnv.wrap(tradeToken)({}))
    const orders = await Promise.all(promises)
    await requestFundsForManyFromFaucet(Network.RMS, orders.map(o => ({ toAddress: o.payload.targetAddress, amount: o.payload.amount })))

    const tradeQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('token', '==', helper.token!.uid)
    await wait(async () => {
      const snap = await tradeQuery.get()
      return snap.size === count
    })
    
    await helper.createSellTradeOrder(15, MIN_IOTA_AMOUNT)

    await wait(async () => {
      const snap = await tradeQuery.get()
      return snap.size === count + 1
    })

    await wait(async () => {
      const trades = (await tradeQuery.get()).docs.map(d => <TokenTradeOrder>d.data())
      const allFulfilled = trades.reduce((acc, act) => acc && act.status === TokenTradeOrderStatus.SETTLED, true)
      return allFulfilled
    })

    await awaitTransactionConfirmationsForToken(helper.token!.uid)
  })

  afterAll(async () => {
    await helper.listener!.cancel()
  })

})
