/* eslint-disable @typescript-eslint/no-explicit-any */

import { MIN_IOTA_AMOUNT } from "../../interfaces/config"
import { TokenPurchase } from "../../interfaces/models"
import { COL } from "../../interfaces/models/base"
import admin from "../../src/admin.config"
import { wait } from "../../test/controls/common"
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

  it('Fulfill buy with lowest sell', async () => {
    await helper.createSellTradeOrder(5, MIN_IOTA_AMOUNT)
    await helper.createSellTradeOrder(5, 2 * MIN_IOTA_AMOUNT)
    await helper.createBuyOrder(5, 2 * MIN_IOTA_AMOUNT)

    const purchaseQuery = admin.firestore().collection(COL.TOKEN_PURCHASE).where('token', '==', helper.token!.uid)
    await wait(async () => {
      const snap = await purchaseQuery.get()
      return snap.size === 1
    })
    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data()

    expect(purchase.count).toBe(5)
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT)

    await awaitTransactionConfirmationsForToken(helper.token!.uid)
  })

  afterAll(async () => {
    await helper.listener!.cancel()
  })

})
