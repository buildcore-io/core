import * as functions from 'firebase-functions';
import bigDecimal from 'js-big-decimal';
import { Member, Transaction, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenBuySellOrder, TokenBuySellOrderStatus, TokenBuySellOrderType, TokenPurchase } from '../../interfaces/models/token';
import admin from '../admin.config';
import { guardedRerun } from '../utils/common.utils';
import { serverTime, uOn } from '../utils/dateTime.utils';
import { creditBuyer } from '../utils/token-buy-sell.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

export const TOKEN_SALE_ORDER_FETCH_LIMIT = 50

export const onTokenBuySellCreated = functions.runWith({ timeoutSeconds: 540, memory: "512MB" })
  .firestore.document(COL.TOKEN_MARKET + '/{buySellId}').onCreate(async (snap) => {
    const data = <TokenBuySellOrder>snap.data()
    await guardedRerun(async () => !(await fulfillSales(data.uid)))
  })

const updateSale = (sale: TokenBuySellOrder, purchase: TokenPurchase) => ({
  ...sale,
  fulfilled: sale.fulfilled + purchase.count,
  status: sale.count === sale.fulfilled + purchase.count ? TokenBuySellOrderStatus.SETTLED : TokenBuySellOrderStatus.ACTIVE
})

const createPurchase = (buy: TokenBuySellOrder, sell: TokenBuySellOrder): TokenPurchase | undefined => {
  const tokensNeeded = buy.count - buy.fulfilled
  const tokensLeft = sell.count - sell.fulfilled
  if (tokensLeft === 0) {
    return undefined
  }
  const tokens = Math.min(tokensLeft, tokensNeeded);
  return ({
    uid: getRandomEthAddress(),
    token: buy.token,
    sell: sell.uid,
    buy: buy.uid,
    count: tokens,
    price: sell.price,
    createdOn: serverTime(),
  })
}


const createBillPayment = async (
  count: number,
  price: number,
  token: Token,
  sell: TokenBuySellOrder,
  buy: TokenBuySellOrder,
  transaction: admin.firestore.Transaction
) => {
  const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sell.owner}`).get()).data()
  const buyer = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buy.owner}`).get()).data()
  const order = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`).get()).data()
  const amount = Number(bigDecimal.floor(bigDecimal.multiply(count, price)))
  const data = <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: sell.owner,
    createdOn: serverTime(),
    payload: {
      amount,
      sourceAddress: order.payload.targetAddress,
      targetAddress: seller.validatedAddress,
      previousOwnerEntity: 'member',
      previousOwner: buyer.uid,
      sourceTransaction: [buy.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid,
      quantity: count
    }
  }
  transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), data)
  return data.uid
}

const updateSaleLock = (prev: TokenBuySellOrder, sell: TokenBuySellOrder, transaction: admin.firestore.Transaction) => {
  const diff = sell.fulfilled - prev.fulfilled;
  const docRef = admin.firestore().doc(`${COL.TOKEN}/${sell.token}/${SUB_COL.DISTRIBUTION}/${sell.owner}`)
  const data = {
    lockedForSale: admin.firestore.FieldValue.increment(-diff),
    sold: admin.firestore.FieldValue.increment(diff),
    tokenOwned: admin.firestore.FieldValue.increment(-diff)
  }
  transaction.update(docRef, data)
}

const updateBuy = (prev: TokenBuySellOrder, buy: TokenBuySellOrder, transaction: admin.firestore.Transaction) => {
  const diff = buy.fulfilled - prev.fulfilled;
  const docRef = admin.firestore().doc(`${COL.TOKEN}/${buy.token}/${SUB_COL.DISTRIBUTION}/${buy.owner}`)
  const data = {
    totalPurchased: admin.firestore.FieldValue.increment(diff),
    tokenOwned: admin.firestore.FieldValue.increment(diff)
  }
  transaction.update(docRef, data)
}

const fulfillSales = (docId: string) => admin.firestore().runTransaction(async (transaction) => {
  const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${docId}`)
  const doc = <TokenBuySellOrder>(await transaction.get(docRef)).data()
  const refs = (await getSaleQuery(doc).get()).docs.filter(d => d.data().owner !== doc.owner).map(d => d.ref)
  const docs = refs.length ? (await transaction.getAll(...refs)).map(d => <TokenBuySellOrder>d.data()) : []
  const purchases = [] as TokenPurchase[]
  const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${doc.token}`).get()).data()

  let update = doc
  for (const b of docs) {
    if (update.status === TokenBuySellOrderStatus.SETTLED || b.status === TokenBuySellOrderStatus.SETTLED) {
      continue
    }
    const isSell = doc.type === TokenBuySellOrderType.SELL
    const prevBuy = isSell ? b : update
    const prevSell = isSell ? update : b
    const purchase = createPurchase(prevBuy, prevSell)
    if (!purchase) {
      continue
    }
    const sell = updateSale(prevSell, purchase)
    const buy = updateSale(prevBuy, purchase)
    const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${b.uid}`)
    transaction.update(docRef, uOn(isSell ? buy : sell))

    updateSaleLock(prevSell, sell, transaction)
    updateBuy(prevBuy, buy, transaction)
    const billPaymentId = await createBillPayment((sell.fulfilled - prevSell.fulfilled), sell.price, token, sell, buy, transaction)

    transaction.create(admin.firestore().doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`), { ...purchase, billPaymentId })
    purchases.push({ ...purchase, billPaymentId })

    update = isSell ? sell : buy
  }
  transaction.update(docRef, uOn(update))

  if (update.type === TokenBuySellOrderType.BUY && update.status === TokenBuySellOrderStatus.SETTLED) {
    await creditBuyer(update, purchases, transaction)
  }

  return update.status === TokenBuySellOrderStatus.SETTLED || docs.length === 0
})


const getSaleQuery = (sale: TokenBuySellOrder) =>
  admin.firestore().collection(COL.TOKEN_MARKET)
    .where('type', '==', sale.type === TokenBuySellOrderType.BUY ? TokenBuySellOrderType.SELL : TokenBuySellOrderType.BUY)
    .where('token', '==', sale.token)
    .where('price', sale.type === TokenBuySellOrderType.BUY ? '<=' : '>=', sale.price)
    .where('status', '==', TokenBuySellOrderStatus.ACTIVE)
    .orderBy('price')
    .orderBy('createdOn')
    .limit(TOKEN_SALE_ORDER_FETCH_LIMIT)
