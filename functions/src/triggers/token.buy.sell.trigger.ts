import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Member, Transaction, TransactionCreditType, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenBuySellOrder, TokenPurchase } from '../../interfaces/models/token';
import { serverTime, uOn } from '../utils/dateTime.utils';
import { memberDocRef } from '../utils/token.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

export const TOKEN_SALE_ORDER_FETCH_LIMIT = 100

export const onTokenBuySellCreated = functions.runWith({ timeoutSeconds: 540, memory: "512MB" })
  .firestore.document(COL.TOKEN_MARKET + '/{buySellId}').onCreate(async (snap) => {
    const data = <TokenBuySellOrder>snap.data()
    let settled = await fulfillSales(data.uid)
    while (!settled) {
      settled = await fulfillSales(data.uid)
    }
  })


const fulfillSale = (buy: TokenBuySellOrder, sell: TokenBuySellOrder, transaction: admin.firestore.Transaction) => {
  const tokensNeeded = buy.count - buy.fulfilled
  const tokensLeft = sell.count - sell.fulfilled
  if (tokensLeft === 0) {
    return undefined
  }
  const tokens = Math.min(tokensLeft, tokensNeeded);

  const purchase = {
    uid: getRandomEthAddress(),
    sell: sell.uid,
    buy: buy.uid,
    count: tokens,
    price: sell.price,
    createdOn: serverTime()
  }
  transaction.create(admin.firestore().doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`), purchase)

  const update = (sale: TokenBuySellOrder) => ({
    ...sale,
    fulfilled: sale.fulfilled + tokens,
    settled: sale.count === sale.fulfilled + tokens
  })
  return { buy: update(buy), sell: update(sell), purchase }
}

const creditBuyer = async (buy: TokenBuySellOrder, newPurchase: TokenPurchase[], transaction: admin.firestore.Transaction) => {
  const oldPurchases = (await admin.firestore().collection(COL.TOKEN_PURCHASE).where('buy', '==', buy.uid).get()).docs.map(d => <TokenPurchase>d.data())
  const totalPaid = [...oldPurchases, ...newPurchase].reduce((sum, act) => sum + (act.price * act.count), 0);
  const refundAmount = buy.price * buy.count - totalPaid
  if (!refundAmount) {
    return;
  }

  const member = <Member>(await memberDocRef(buy.owner).get()).data()
  const token = <Token>(await admin.firestore().doc(`${COL.TOKENS}/${buy.token}`).get()).data()
  const order = <Transaction>(await (admin.firestore().doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`).get())).data()
  const tranId = getRandomEthAddress();

  const data = <Transaction>{
    type: TransactionType.CREDIT,
    uid: tranId,
    space: token.space,
    member: member.uid,
    createdOn: serverTime(),
    payload: {
      type: TransactionCreditType.TOKEN_BUY,
      amount: refundAmount,
      sourceAddress: order.payload.targetAddress,
      targetAddress: member.validatedAddress,
      sourceTransactions: [order.uid],
      token: token.uid,
      reconciled: true,
      void: false,
      invalidPayment: true
    }
  };
  const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${tranId}`)
  transaction.create(docRef, data)
}

const updateSaleLock = (prev: TokenBuySellOrder, sell: TokenBuySellOrder, transaction: admin.firestore.Transaction) => {
  const diff = sell.fulfilled - prev.fulfilled;
  const docRef = admin.firestore().doc(`${COL.TOKENS}/${sell.token}/${SUB_COL.DISTRIBUTION}/${sell.owner}`)
  const data = {
    lockedForSale: admin.firestore.FieldValue.increment(-diff),
    sold: admin.firestore.FieldValue.increment(diff),
    tokenOwned: admin.firestore.FieldValue.increment(-diff)
  }
  transaction.update(docRef, data)
}

const updateBuy = (prev: TokenBuySellOrder, buy: TokenBuySellOrder, transaction: admin.firestore.Transaction) => {
  const diff = buy.fulfilled - prev.fulfilled;
  const docRef = admin.firestore().doc(`${COL.TOKENS}/${buy.token}/${SUB_COL.DISTRIBUTION}/${buy.owner}`)
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

  const update = docs.reduce((a, b) => {
    if (a.settled || b.settled) {
      return a
    }
    const isSell = doc.type === 'sell'
    const buy = isSell ? b : a
    const sell = isSell ? a : b
    const sale = fulfillSale(buy, sell, transaction)
    if (!sale) {
      return a
    }
    const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${b.uid}`)
    transaction.update(docRef, uOn(isSell ? sale.buy : sale.sell))

    updateSaleLock(sell, sale.sell, transaction)
    updateBuy(buy, sale.buy, transaction)
    purchases.push(sale.purchase)

    return isSell ? sale.sell : sale.buy
  }, doc)
  transaction.update(docRef, uOn(update))

  if (update.type === 'buy' && update.settled) {
    await creditBuyer(update, purchases, transaction)
  }

  return update.settled || docs.length === 0
})


const getSaleQuery = (sale: TokenBuySellOrder) =>
  admin.firestore().collection(COL.TOKEN_MARKET)
    .where('type', '==', sale.type === 'buy' ? 'sell' : 'buy')
    .where('token', '==', sale.token)
    .where('price', sale.type === 'buy' ? '<=' : '>=', sale.price)
    .where('settled', '==', false)
    .orderBy('price', 'asc')
    .limit(TOKEN_SALE_ORDER_FETCH_LIMIT)
