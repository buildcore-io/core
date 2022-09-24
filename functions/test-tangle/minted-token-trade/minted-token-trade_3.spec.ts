/* eslint-disable @typescript-eslint/no-explicit-any */

import { MIN_IOTA_AMOUNT } from "../../interfaces/config"
import { TokenTradeOrder } from "../../interfaces/models"
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


  it('Fulfill sell with two buys', async () => {
    await helper.createBuyOrder(5, MIN_IOTA_AMOUNT)
    await helper.createBuyOrder(5, MIN_IOTA_AMOUNT)
    await helper.createSellTradeOrder()

    await wait(async () => {
      const orders = (await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', helper.buyer).get()).docs.map(d => <TokenTradeOrder>d.data())
      const fulfilled = orders.filter(o => o.count === o.fulfilled)
      return fulfilled.length === orders.length
    })

    await awaitTransactionConfirmationsForToken(helper.token!.uid)
  })

  afterAll(async () => {
    await helper.listener!.cancel()
  })

})
