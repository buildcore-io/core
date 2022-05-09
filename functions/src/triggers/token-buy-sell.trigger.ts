import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Member, Transaction, TransactionCreditType, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenBuySellOrder, TokenBuySellOrderType, TokenPurchase } from '../../interfaces/models/token';
import { serverTime, uOn } from '../utils/dateTime.utils';
import { memberDocRef } from '../utils/token.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

export const TOKEN_SALE_ORDER_FETCH_LIMIT = 50

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
  const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${buy.token}`).get()).data()
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
      sourceTransactions: [buy.paymentTransactionId],
      token: token.uid,
      reconciled: true,
      void: false,
      invalidPayment: true
    }
  };
  const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${tranId}`)
  transaction.create(docRef, data)
}

const createBillPayment = async (
  amount: number,
  token: Token,
  sell: TokenBuySellOrder,
  buy: TokenBuySellOrder,
  transaction: admin.firestore.Transaction
) => {
  const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sell.owner}`).get()).data()
  const buyer = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buy.owner}`).get()).data()
  const data = <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: sell.owner,
    createdOn: serverTime(),
    payload: {
      amount,
      sourceAddress: buyer.validatedAddress,
      previousOwnerEntity: 'member',
      previousOwner: buyer.uid,
      targetAddress: seller.validatedAddress,
      sourceTransaction: [buy.paymentTransactionId],
      royalty: false,
      void: false,
    }
  }
  transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), data)
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
    if (update.settled || b.settled) {
      continue
    }
    const isSell = doc.type === TokenBuySellOrderType.SELL
    const buy = isSell ? b : update
    const sell = isSell ? update : b
    const sale = fulfillSale(buy, sell, transaction)
    if (!sale) {
      continue
    }
    const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${b.uid}`)
    transaction.update(docRef, uOn(isSell ? sale.buy : sale.sell))

    updateSaleLock(sell, sale.sell, transaction)
    updateBuy(buy, sale.buy, transaction)
    await createBillPayment((sale.sell.fulfilled - sell.fulfilled) * sell.price, token, sell, buy, transaction)
    purchases.push(sale.purchase)

    update = isSell ? sale.sell : sale.buy
  }
  transaction.update(docRef, uOn(update))

  if (update.type === TokenBuySellOrderType.BUY && update.settled) {
    await creditBuyer(update, purchases, transaction)
  }

  return update.settled || docs.length === 0
})


const getSaleQuery = (sale: TokenBuySellOrder) =>
  admin.firestore().collection(COL.TOKEN_MARKET)
    .where('type', '==', sale.type === TokenBuySellOrderType.BUY ? TokenBuySellOrderType.SELL : TokenBuySellOrderType.BUY)
    .where('token', '==', sale.token)
    .where('price', sale.type === TokenBuySellOrderType.BUY ? '<=' : '>=', sale.price)
    .where('settled', '==', false)
    .orderBy('price')
    .orderBy('createdOn')
    .limit(TOKEN_SALE_ORDER_FETCH_LIMIT)
