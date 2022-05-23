import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import bigDecimal from 'js-big-decimal';
import { MIN_IOTA_AMOUNT, SECONDARY_TRANSACTION_DELAY } from '../../interfaces/config';
import { Member, Space, Transaction, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenBuySellOrder, TokenBuySellOrderStatus, TokenBuySellOrderType, TokenPurchase } from '../../interfaces/models/token';
import admin from '../admin.config';
import { guardedRerun } from '../utils/common.utils';
import { getRoyaltyPercentage, getRoyaltySpaces, getSpaceOneRoyaltyPercentage } from '../utils/config.utils';
import { dateToTimestamp, serverTime, uOn } from '../utils/dateTime.utils';
import { creditBuyer } from '../utils/token-buy-sell.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

export const TOKEN_SALE_ORDER_FETCH_LIMIT = 50

export const onTokenBuySellCreated = functions.runWith({ timeoutSeconds: 540, memory: "512MB" })
  .firestore.document(COL.TOKEN_MARKET + '/{buySellId}').onCreate(async (snap) => {
    const data = <TokenBuySellOrder>snap.data()
    await guardedRerun(async () => !(await fulfillSales(data.uid)))
  })

const updateSale = (sale: TokenBuySellOrder, purchase: TokenPurchase) => {
  const fulfilled = sale.fulfilled + purchase.count
  const balanceFunc = sale.type === TokenBuySellOrderType.BUY ? bigDecimal.subtract : bigDecimal.add
  const purchaseAmount = bigDecimal.floor(bigDecimal.multiply(purchase.count, purchase.price))
  const balance = Number(balanceFunc(sale.balance, purchaseAmount))
  const balanceLeft = sale.type === TokenBuySellOrderType.BUY ? balance : (sale.totalDeposit - balance)
  const status = sale.count === fulfilled ? TokenBuySellOrderStatus.SETTLED : TokenBuySellOrderStatus.ACTIVE
  return ({
    ...sale,
    fulfilled,
    balance,
    status,
    expiresAt: balanceLeft > 0 && balanceLeft < MIN_IOTA_AMOUNT ? dateToTimestamp(dayjs().toDate()) : sale.expiresAt
  })
}

const createPurchase = (buy: TokenBuySellOrder, sell: TokenBuySellOrder) => {
  if (buy.status === TokenBuySellOrderStatus.SETTLED || sell.status === TokenBuySellOrderStatus.SETTLED) {
    return undefined;
  }
  const tokensLeft = sell.count - sell.fulfilled
  if (tokensLeft === 0) {
    return undefined
  }
  const tokens = Math.min(tokensLeft, buy.count - buy.fulfilled);
  const tokensPrice = Number(bigDecimal.floor(bigDecimal.multiply(tokens, sell.price)))
  const buyBalanceLeft = Number(bigDecimal.subtract(buy.balance, tokensPrice))
  if (tokensPrice < MIN_IOTA_AMOUNT || (buyBalanceLeft > 0 && buyBalanceLeft < MIN_IOTA_AMOUNT)) {
    return undefined;
  }

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
    return { amount: totalAmount, royalties: royaltySpaces.map(_ => 0) }
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
  sell: TokenBuySellOrder,
  buy: TokenBuySellOrder,
  transaction: admin.firestore.Transaction
) => {
  const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sell.owner}`).get()).data()
  const buyer = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buy.owner}`).get()).data()
  const order = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`).get()).data()
  const { amount, royalties } = getRoyalties(count, price)

  const sellerBillPayment = <Transaction>{
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
    },
  }
  transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${sellerBillPayment.uid}`), sellerBillPayment)

  const royaltyPaymentPromises = getRoyaltySpaces().map(async (space, index) => {
    const spaceData = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space}`).get()).data()
    return <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      space: token.space,
      member: sell.owner,
      createdOn: serverTime(),
      payload: {
        amount: royalties[index],
        sourceAddress: order.payload.targetAddress,
        targetAddress: spaceData.validatedAddress,
        previousOwnerEntity: 'member',
        previousOwner: buyer.uid,
        sourceTransaction: [buy.paymentTransactionId],
        royalty: true,
        void: false,
        // We delay royalty.
        delay: SECONDARY_TRANSACTION_DELAY * (index + 1),
        token: token.uid,
        quantity: count
      },
      ignoreWallet: royalties[index] < MIN_IOTA_AMOUNT
    }
  })
  const royaltyPayments = (await Promise.all(royaltyPaymentPromises))
  royaltyPayments.forEach(royaltyPayment => transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${royaltyPayment.uid}`), royaltyPayment))

  return sellerBillPayment.uid
}

const updateSaleLock = (prev: TokenBuySellOrder, sell: TokenBuySellOrder, transaction: admin.firestore.Transaction) => {
  const diff = sell.fulfilled - prev.fulfilled;
  const docRef = admin.firestore().doc(`${COL.TOKEN}/${sell.token}/${SUB_COL.DISTRIBUTION}/${sell.owner}`)
  const data = {
    lockedForSale: admin.firestore.FieldValue.increment(-diff),
    sold: admin.firestore.FieldValue.increment(diff),
    tokenOwned: admin.firestore.FieldValue.increment(-diff)
  }
  transaction.set(docRef, data, { merge: true })
}

const updateBuy = (prev: TokenBuySellOrder, buy: TokenBuySellOrder, transaction: admin.firestore.Transaction) => {
  const diff = buy.fulfilled - prev.fulfilled;
  const docRef = admin.firestore().doc(`${COL.TOKEN}/${buy.token}/${SUB_COL.DISTRIBUTION}/${buy.owner}`)
  const data = {
    totalPurchased: admin.firestore.FieldValue.increment(diff),
    tokenOwned: admin.firestore.FieldValue.increment(diff)
  }
  transaction.set(docRef, data, { merge: true })
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
    const billPaymentId = await createBillPayments(purchase.count, purchase.price, token, sell, buy, transaction)

    transaction.create(admin.firestore().doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`), { ...purchase, billPaymentId })
    purchases.push({ ...purchase, billPaymentId })

    update = isSell ? sell : buy
  }
  transaction.update(docRef, uOn(update))

  if (update.type === TokenBuySellOrderType.BUY && update.status === TokenBuySellOrderStatus.SETTLED) {
    await creditBuyer(update, purchases, transaction)
  }

  return update.status === TokenBuySellOrderStatus.SETTLED || update.fulfilled === doc.fulfilled
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
