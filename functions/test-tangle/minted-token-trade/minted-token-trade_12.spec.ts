/* eslint-disable @typescript-eslint/no-explicit-any */

import dayjs from "dayjs"
import { MIN_IOTA_AMOUNT } from "../../interfaces/config"
import { Member, Network, TokenTradeOrder, TokenTradeOrderStatus, Transaction } from "../../interfaces/models"
import { COL } from "../../interfaces/models/base"
import admin from "../../src/admin.config"
import { cancelExpiredSale } from "../../src/cron/token.cron"
import { getAddress } from "../../src/utils/address.utils"
import { dateToTimestamp } from "../../src/utils/dateTime.utils"
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

  it('Half fulfill buy and make it expired it', async () => {
    await helper.createSellTradeOrder(5, MIN_IOTA_AMOUNT)
    await helper.createBuyOrder()

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', helper.buyer)
    await wait(async () => {
      const orders = (await query.get()).docs.map(d => <TokenTradeOrder>d.data())
      return orders.length === 1 && orders[0].fulfilled === 5
    })
    let buy = <TokenTradeOrder>(await query.get()).docs[0].data()
    await admin.firestore().doc(`${COL.TOKEN_MARKET}/${buy.uid}`).update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'd').toDate()) })

    await cancelExpiredSale()

    const buyQuery = admin.firestore().doc(`${COL.TOKEN_MARKET}/${buy.uid}`)
    await wait(async () => {
      buy = <TokenTradeOrder>(await buyQuery.get()).data()
      return buy.status === TokenTradeOrderStatus.EXPIRED
    })

    const credit = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${buy.creditTransactionId}`).get()).data()
    expect(credit.member).toBe(helper.buyer)
    const buyer = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${helper.buyer!}`).get()).data()
    expect(credit.payload.targetAddress).toBe(getAddress(buyer, Network.RMS))
    expect(credit.payload.amount).toBe(5 * MIN_IOTA_AMOUNT)

    await awaitTransactionConfirmationsForToken(helper.token!.uid)
  })

  it('Half fulfill sell and make it expired it', async () => {
    await helper.createBuyOrder(5, MIN_IOTA_AMOUNT)
    await helper.createSellTradeOrder()

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', helper.seller)
    await wait(async () => {
      const orders = (await query.get()).docs.map(d => <TokenTradeOrder>d.data())
      return orders.length === 1 && orders[0].fulfilled === 5
    })
    let sell = <TokenTradeOrder>(await query.get()).docs[0].data()
    await admin.firestore().doc(`${COL.TOKEN_MARKET}/${sell.uid}`).update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'd').toDate()) })

    await cancelExpiredSale()

    const sellQuery = admin.firestore().doc(`${COL.TOKEN_MARKET}/${sell.uid}`)
    await wait(async () => {
      sell = <TokenTradeOrder>(await sellQuery.get()).data()
      return sell.status === TokenTradeOrderStatus.EXPIRED
    })

    const credit = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${sell.creditTransactionId}`).get()).data()
    expect(credit.member).toBe(helper.seller)
    const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${helper.seller!}`).get()).data()
    expect(credit.payload.targetAddress).toBe(getAddress(seller, Network.RMS))
    expect(credit.payload.amount).toBe(50800)
    expect(credit.payload.nativeTokens[0].amount).toBe(5)

    await awaitTransactionConfirmationsForToken(helper.token!.uid)
  })

  afterAll(async () => {
    await helper.listener!.cancel()
  })

})
