import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import bigDecimal from 'js-big-decimal';
import { cloneDeep, isEmpty, last } from 'lodash';
import { DEFAULT_NETWORK, MIN_IOTA_AMOUNT } from '../../../interfaces/config';
import { Member, Network, Space, Transaction, TransactionType } from '../../../interfaces/models';
import { COL, SUB_COL } from '../../../interfaces/models/base';
import { Token, TokenPurchase, TokenTradeOrder, TokenTradeOrderStatus, TokenTradeOrderType } from '../../../interfaces/models/token';
import admin from '../../admin.config';
import { getAddress } from '../../utils/address.utils';
import { guardedRerun } from '../../utils/common.utils';
import { getRoyaltyPercentage, getRoyaltySpaces, getSpaceOneRoyaltyPercentage } from '../../utils/config.utils';
import { dateToTimestamp, serverTime, uOn } from '../../utils/dateTime.utils';
import { creditBuyer } from '../../utils/token-trade.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { getSaleQuery, StartAfter } from './token-trade-order.trigger';

export const matchSimpleToken = async (tradeOrderId: string) => {
  let startAfter: StartAfter | undefined = undefined

  await guardedRerun(async () => {
    startAfter = await fulfillSales(tradeOrderId, startAfter)
    return startAfter !== undefined
  }, 10000000)
}

const updateSale = (sale: TokenTradeOrder, purchase: TokenPurchase) => {
  const fulfilled = sale.fulfilled + purchase.count
  const balanceFunc = sale.type === TokenTradeOrderType.BUY ? bigDecimal.subtract : bigDecimal.add
  const purchaseAmount = bigDecimal.floor(bigDecimal.multiply(purchase.count, purchase.price))
  const balance = Number(balanceFunc(sale.balance, purchaseAmount))
  const balanceLeft = sale.type === TokenTradeOrderType.BUY ? balance : (sale.totalDeposit - balance)
  const status = sale.count === fulfilled ? TokenTradeOrderStatus.SETTLED : TokenTradeOrderStatus.ACTIVE
  return ({
    ...sale,
    fulfilled,
    balance,
    status,
    expiresAt: balanceLeft > 0 && balanceLeft < MIN_IOTA_AMOUNT ? dateToTimestamp(dayjs().toDate()) : sale.expiresAt
  })
}

const createPurchase = (buy: TokenTradeOrder, sell: TokenTradeOrder, triggeredBy: TokenTradeOrderType) => {
  const tokens = Math.min(sell.count - sell.fulfilled, buy.count - buy.fulfilled);

  const sellPrice = Number(bigDecimal.floor(bigDecimal.multiply(tokens, sell.price)))
  if (sellPrice < MIN_IOTA_AMOUNT) {
    return
  }

  const buyBalanceLeft = Number(bigDecimal.subtract(buy.balance, sellPrice))
  if (buyBalanceLeft > 0 && buyBalanceLeft < MIN_IOTA_AMOUNT) {
    return;
  }

  const buyPriceLeft = Number(bigDecimal.multiply(buy.count - buy.fulfilled - tokens, buy.price))
  if (buyPriceLeft > 0 && buyPriceLeft < MIN_IOTA_AMOUNT) {
    return;
  }

  return <TokenPurchase>({
    uid: getRandomEthAddress(),
    token: buy.token,
    sell: sell.uid,
    buy: buy.uid,
    count: tokens,
    price: sell.price,
    createdOn: serverTime(),
    triggeredBy
  })
}

interface Royalties {
  readonly amount: number;
  readonly royalties: number[];
}

const getRoyalties = (count: number, price: number): Royalties => {
  const percentage = getRoyaltyPercentage()
  const spaceOnePercentage = getSpaceOneRoyaltyPercentage()
  const royaltySpaces = getRoyaltySpaces()
  const totalAmount = Number(bigDecimal.floor(bigDecimal.multiply(count, price)))
  if (isNaN(percentage) || !percentage || isNaN(spaceOnePercentage) || !spaceOnePercentage || royaltySpaces.length !== 2) {
    functions.logger.error('Token sale config is missing');
    return { amount: totalAmount, royalties: royaltySpaces.map(() => 0) }
  }

  const royaltyAmount = Number(bigDecimal.ceil(bigDecimal.multiply(totalAmount, percentage / 100)))
  const royaltiesSpaceOne = Number(bigDecimal.ceil(bigDecimal.multiply(royaltyAmount, spaceOnePercentage / 100)))
  const royaltiesSpaceTwo = Number(bigDecimal.subtract(royaltyAmount, royaltiesSpaceOne))
  const royaltySum = [royaltiesSpaceOne, royaltiesSpaceTwo].map(r => r >= MIN_IOTA_AMOUNT ? r : 0)
    .reduce((sum, act) => Number(bigDecimal.add(sum, act)), 0)
  return { amount: Number(bigDecimal.subtract(totalAmount, royaltySum)), royalties: [royaltiesSpaceOne, royaltiesSpaceTwo] }
}

const createBillPayments = async (
  count: number,
  price: number,
  token: Token,
  sell: TokenTradeOrder,
  buy: TokenTradeOrder,
  transaction: admin.firestore.Transaction
) => {
  const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sell.owner}`).get()).data()
  const order = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`).get()).data()
  const { amount, royalties } = getRoyalties(count, price)

  const sellerBillPayment = <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: buy.owner,
    createdOn: serverTime(),
    sourceNetwork: order.sourceNetwork || DEFAULT_NETWORK,
    targetNetwork: order.targetNetwork || DEFAULT_NETWORK,
    payload: {
      amount,
      sourceAddress: order.payload.targetAddress,
      targetAddress: getAddress(seller, Network.IOTA),
      previousOwnerEntity: 'member',
      previousOwner: sell.owner,
      sourceTransaction: [buy.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid,
      quantity: count
    },
  }
  transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${sellerBillPayment.uid}`), sellerBillPayment)

  const royaltyPaymentPromises = getRoyaltySpaces().map(async (space, index) => {
    const spaceData = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space}`).get()).data()
    return <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      space: token.space,
      member: buy.owner,
      createdOn: serverTime(),
      sourceNetwork: order.sourceNetwork || DEFAULT_NETWORK,
      targetNetwork: order.targetNetwork || DEFAULT_NETWORK,
      payload: {
        amount: royalties[index],
        sourceAddress: order.payload.targetAddress,
        targetAddress: getAddress(spaceData, Network.IOTA),
        previousOwnerEntity: 'member',
        previousOwner: sell.owner,
        sourceTransaction: [buy.paymentTransactionId],
        royalty: true,
        void: false,
        token: token.uid,
        quantity: count
      },
      ignoreWallet: royalties[index] < MIN_IOTA_AMOUNT
    }
  })
  const royaltyPayments = (await Promise.all(royaltyPaymentPromises))
  royaltyPayments.forEach(royaltyPayment => transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${royaltyPayment.uid}`), royaltyPayment))

  return {
    billPaymentId: buy.paymentTransactionId,
    sellerBillPayment: sellerBillPayment.uid,
    royaltyPayments: royaltyPayments.map( o => o.uid)
  }
}

const updateSaleLock = (prev: TokenTradeOrder, sell: TokenTradeOrder, transaction: admin.firestore.Transaction) => {
  const diff = sell.fulfilled - prev.fulfilled;
  const docRef = admin.firestore().doc(`${COL.TOKEN}/${sell.token}/${SUB_COL.DISTRIBUTION}/${sell.owner}`)
  const data = {
    lockedForSale: admin.firestore.FieldValue.increment(-diff),
    sold: admin.firestore.FieldValue.increment(diff),
    tokenOwned: admin.firestore.FieldValue.increment(-diff)
  }
  transaction.set(docRef, data, { merge: true })
}

const updateBuy = (prev: TokenTradeOrder, buy: TokenTradeOrder, transaction: admin.firestore.Transaction) => {
  const diff = buy.fulfilled - prev.fulfilled;
  const docRef = admin.firestore().doc(`${COL.TOKEN}/${buy.token}/${SUB_COL.DISTRIBUTION}/${buy.owner}`)
  const data = {
    totalPurchased: admin.firestore.FieldValue.increment(diff),
    tokenOwned: admin.firestore.FieldValue.increment(diff)
  }
  transaction.set(docRef, data, { merge: true })
}

const fulfillSales = (tradeOrderId: string, startAfter: StartAfter | undefined) => admin.firestore().runTransaction(async (transaction) => {
  const tradeOrderDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${tradeOrderId}`)
  const tradeOrder = <TokenTradeOrder>(await transaction.get(tradeOrderDocRef)).data()
  if (tradeOrder.status !== TokenTradeOrderStatus.ACTIVE) {
    return;
  }
  const docs = (await getSaleQuery(tradeOrder, startAfter).get()).docs
  const trades = isEmpty(docs) ? [] : (await transaction.getAll(...docs.map(d => d.ref))).map(d => <TokenTradeOrder>d.data())
  const purchases = [] as TokenPurchase[]
  const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${tradeOrder.token}`).get()).data()

  let update = cloneDeep(tradeOrder)
  for (const trade of trades) {
    const isSell = tradeOrder.type === TokenTradeOrderType.SELL
    const prevBuy = isSell ? trade : update
    const prevSell = isSell ? update : trade
    if ([prevBuy.status, prevSell.status].includes(TokenTradeOrderStatus.SETTLED)) {
      continue
    }
    const purchase = createPurchase(prevBuy, prevSell, (isSell ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY))
    if (!purchase) {
      continue
    }
    const sell = updateSale(prevSell, purchase)
    const buy = updateSale(prevBuy, purchase)
    const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${trade.uid}`)
    transaction.update(docRef, uOn(isSell ? buy : sell))

    updateSaleLock(prevSell, sell, transaction)
    updateBuy(prevBuy, buy, transaction)
    const billPaymentRes = await createBillPayments(purchase.count, purchase.price, token, sell, buy, transaction)

    transaction.create(admin.firestore().doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`), {
      ...purchase,
      billPaymentId: billPaymentRes.billPaymentId,
      buyerBillPaymentId: billPaymentRes.sellerBillPayment,
      royaltyBillPayments: billPaymentRes.royaltyPayments
    })
    purchases.push({
      ...purchase,
      billPaymentId: billPaymentRes.billPaymentId,
      buyerBillPaymentId: billPaymentRes.sellerBillPayment,
      royaltyBillPayments: billPaymentRes.royaltyPayments
    })

    update = isSell ? sell : buy
  }
  const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${tradeOrder.uid}`)
  transaction.update(docRef, uOn(update))

  if (update.type === TokenTradeOrderType.BUY && update.status === TokenTradeOrderStatus.SETTLED) {
    await creditBuyer(update, purchases, transaction)
  }

  return update.status === TokenTradeOrderStatus.SETTLED ? undefined : last(docs)
})
