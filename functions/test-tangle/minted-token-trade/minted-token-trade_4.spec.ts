/* eslint-disable @typescript-eslint/no-explicit-any */

import { TokenTradeOrder, Transaction, TransactionType } from "../../interfaces/models"
import { COL } from "../../interfaces/models/base"
import admin from "../../src/admin.config"
import { cancelTradeOrder } from "../../src/controls/token-trading/token-trade-cancel.controller"
import { mockWalletReturnValue } from "../../test/controls/common"
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

  it('Create and cancel sell', async () => {
    await helper.createSellTradeOrder()

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', helper.seller)
    const sell = <TokenTradeOrder>(await query.get()).docs[0].data()
    mockWalletReturnValue(helper.walletSpy, helper.seller!, { uid: sell.uid });
    await testEnv.wrap(cancelTradeOrder)({});

    const sellerCreditSnap = await admin.firestore().collection(COL.TRANSACTION)
      .where('member', '==', helper.seller)
      .where('type', '==', TransactionType.CREDIT)
      .get()
    expect(sellerCreditSnap.size).toBe(1)
    const sellerCredit = sellerCreditSnap.docs[0].data() as Transaction
    expect(sellerCredit.payload.amount).toBe(49600)
    expect(sellerCredit.payload.nativeTokens[0].amount).toBe(10)

    await awaitTransactionConfirmationsForToken(helper.token!.uid)
  })

  afterAll(async () => {
    await helper.listener!.cancel()
  })

})