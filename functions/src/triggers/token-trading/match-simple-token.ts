import bigDecimal from 'js-big-decimal';
import { cloneDeep, isEmpty, last, tail } from 'lodash';
import { DEFAULT_NETWORK, MIN_IOTA_AMOUNT } from '../../../interfaces/config';
import { Entity, Member, Space, Transaction, TransactionType } from '../../../interfaces/models';
import { COL, SUB_COL } from '../../../interfaces/models/base';
import { Token, TokenPurchase, TokenTradeOrder, TokenTradeOrderStatus, TokenTradeOrderType } from '../../../interfaces/models/token';
import admin from '../../admin.config';
import { getAddress } from '../../utils/address.utils';
import { guardedRerun } from '../../utils/common.utils';
import { serverTime, uOn } from '../../utils/dateTime.utils';
import { getRoyaltyFees } from '../../utils/token-trade.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { getSaleQuery, getTradesSorted, StartAfter } from './token-trade-order.trigger';

export const matchSimpleToken = async (tradeOrderId: string) => {
  let startAfter: StartAfter | undefined = undefined

  await guardedRerun(async () => {
    startAfter = await fulfillSales(tradeOrderId, startAfter)
    return startAfter !== undefined
  }, 10000000)
}

const updateTrade = (trade: TokenTradeOrder, purchase: TokenPurchase, creditTransactionId = '') => {
  const fulfilled = trade.fulfilled + purchase.count
  const salePrice = bigDecimal.floor(bigDecimal.multiply(purchase.count, purchase.price))
  const balance = trade.balance - (trade.type === TokenTradeOrderType.SELL ? purchase.count : salePrice)
  const status = trade.count === fulfilled ? TokenTradeOrderStatus.SETTLED : TokenTradeOrderStatus.ACTIVE
  return ({ ...trade, fulfilled, balance, status, creditTransactionId })
}

const createBuyPayments = async (
  token: Token,
  buy: TokenTradeOrder,
  sell: TokenTradeOrder,
  buyer: Member,
  seller: Member,
  tokensToTrade: number,
  isSell: boolean
) => {
  let salePrice = Number(bigDecimal.floor(bigDecimal.multiply(tokensToTrade, isSell ? buy.price : sell.price)))
  const balanceLeft = buy.balance - salePrice
  if (balanceLeft > 0 && balanceLeft < MIN_IOTA_AMOUNT) {
    return []
  }
  const buyOrder = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`).get()).data()
  const royaltyFees = getRoyaltyFees(salePrice)
  const royaltyPaymentPromises = Object.entries(royaltyFees).map(async ([space, fee]) => {
    const spaceData = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space}`).get()).data()
    return <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      space: token.space,
      member: buy.owner,
      createdOn: serverTime(),
      network: buy.targetNetwork || DEFAULT_NETWORK,
      payload: {
        amount: fee,
        sourceAddress: buyOrder.payload.targetAddress,
        targetAddress: getAddress(spaceData, buy.sourceNetwork || DEFAULT_NETWORK),
        previousOwnerEntity: Entity.MEMBER,
        previousOwner: buy.owner,
        owner: space,
        ownerEntity: Entity.SPACE,
        sourceTransaction: [buy.paymentTransactionId],
        royalty: true,
        void: false,
        token: token.uid,
        quantity: tokensToTrade
      },
      ignoreWallet: fee < MIN_IOTA_AMOUNT
    }
  })
  const royaltyPayments = await Promise.all(royaltyPaymentPromises)
  royaltyPayments.forEach(p => { salePrice -= p.ignoreWallet ? 0 : p.payload.amount })
  if (salePrice < MIN_IOTA_AMOUNT) {
    return []
  }
  const billPayment = <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: buy.owner,
    createdOn: serverTime(),
    network: buy.targetNetwork || DEFAULT_NETWORK,
    payload: {
      amount: salePrice,
      sourceAddress: buyOrder.payload.targetAddress,
      targetAddress: getAddress(seller, buy.sourceNetwork || DEFAULT_NETWORK),
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: buy.owner,
      owner: sell.owner,
      ownerEntity: Entity.MEMBER,
      sourceTransaction: [buy.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid,
      quantity: tokensToTrade
    }
  }
  if (buy.fulfilled + tokensToTrade < buy.count || !balanceLeft) {
    return [billPayment, ...royaltyPayments]
  }
  const credit = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: buy.owner,
    createdOn: serverTime(),
    network: buy.targetNetwork || DEFAULT_NETWORK,
    payload: {
      dependsOnBillPayment: true,
      amount: balanceLeft,
      sourceAddress: buyOrder.payload.targetAddress,
      targetAddress: getAddress(buyer, buy.sourceNetwork || DEFAULT_NETWORK),
      previousOwnerEntity: Entity.MEMBER,
      previousOwner: buy.owner,
      ownerEntity: Entity.MEMBER,
      owner: buy.owner,
      sourceTransaction: [buy.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid
    }
  }
  return [billPayment, ...royaltyPayments, credit]
}

const createPurchase = async (
  transaction: admin.firestore.Transaction,
  token: Token, buy: TokenTradeOrder,
  sell: TokenTradeOrder,
  isSell: boolean
) => {
  const tokensToTrade = Math.min(sell.count - sell.fulfilled, buy.count - buy.fulfilled);

  const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sell.owner}`).get()).data()
  const buyer = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buy.owner}`).get()).data()
  const buyerPayments = await createBuyPayments(token, buy, sell, buyer, seller, tokensToTrade, isSell)

  if (isEmpty(buyerPayments)) {
    return { purchase: undefined, buyerCreditId: undefined };
  }
  buyerPayments.forEach(p => transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${p.uid}`), p))

  return {
    purchase: <TokenPurchase>({
      uid: getRandomEthAddress(),
      token: buy.token,
      tokenStatus: token.status,
      sell: sell.uid,
      buy: buy.uid,
      count: tokensToTrade,
      price: isSell ? buy.price : sell.price,
      createdOn: serverTime(),
      billPaymentId: buyerPayments[0].uid,
      royaltyBillPayments: tail(buyerPayments).filter(p => p.type !== TransactionType.CREDIT).map(p => p.uid),
      triggeredBy: isSell ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY
    }),
    buyerCreditId: buyerPayments.filter(p => p.type === TransactionType.CREDIT)[0]?.uid || ''
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
  const trades = await getTradesSorted(transaction, docs)
  const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${tradeOrder.token}`).get()).data()

  let update = cloneDeep(tradeOrder)
  for (const trade of trades) {
    const isSell = tradeOrder.type === TokenTradeOrderType.SELL
    const prevBuy = isSell ? trade : update
    const prevSell = isSell ? update : trade
    if ([prevBuy.status, prevSell.status].includes(TokenTradeOrderStatus.SETTLED)) {
      continue
    }
    const { purchase, buyerCreditId } = await createPurchase(transaction, token, prevBuy, prevSell, isSell)
    if (!purchase) {
      continue
    }
    const sell = updateTrade(prevSell, purchase)
    const buy = updateTrade(prevBuy, purchase, buyerCreditId)
    const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${trade.uid}`)
    transaction.update(docRef, uOn(isSell ? buy : sell))

    updateSaleLock(prevSell, sell, transaction)
    updateBuy(prevBuy, buy, transaction)

    transaction.create(admin.firestore().doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`), purchase)
    update = isSell ? sell : buy
  }
  transaction.update(admin.firestore().doc(`${COL.TOKEN_MARKET}/${tradeOrder.uid}`), uOn(update))
  return update.status === TokenTradeOrderStatus.SETTLED ? undefined : last(docs)
})
