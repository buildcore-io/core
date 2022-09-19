import { INodeInfo } from '@iota/iota.js-next';

import bigDecimal from "js-big-decimal";
import { cloneDeep, isEmpty, last } from "lodash";
import { MIN_IOTA_AMOUNT, URL_PATHS } from "../../../interfaces/config";
import { Member, Space, Transaction, TransactionType } from "../../../interfaces/models";
import { COL } from "../../../interfaces/models/base";
import { Token, TokenPurchase, TokenTradeOrder, TokenTradeOrderStatus, TokenTradeOrderType } from "../../../interfaces/models/token";
import admin from "../../admin.config";
import { SmrWallet } from "../../services/wallet/SmrWalletService";
import { WalletService } from "../../services/wallet/wallet";
import { getAddress } from "../../utils/address.utils";
import { packBasicOutput } from "../../utils/basic-output.utils";
import { guardedRerun } from '../../utils/common.utils';
import { cOn, serverTime, uOn } from "../../utils/dateTime.utils";
import { getRoyaltyFees } from '../../utils/token-trade.utils';
import { getRandomEthAddress } from "../../utils/wallet.utils";
import { StartAfter, TOKEN_SALE_ORDER_FETCH_LIMIT } from './token-trade-order.trigger';

export const matchBaseToken = async (tradeOrderId: string) => {
  let startAfter: StartAfter | undefined = undefined
  await guardedRerun(async () => {
    startAfter = await fulfillSales(tradeOrderId, startAfter)
    return startAfter !== undefined
  }, 10000000)
}

const createIotaPayments = async (token: Token, sell: TokenTradeOrder, seller: Member, buyer: Member, count: number): Promise<Transaction[]> => {
  if (count < MIN_IOTA_AMOUNT) {
    return []
  }
  const balance = sell.balance - count
  if (balance !== 0 && balance < MIN_IOTA_AMOUNT) {
    return []
  }
  const sellOrder = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${sell.orderTransactionId}`).get()).data()
  const billPayment = <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    member: sell.owner,
    space: token.space,
    network: sell.sourceNetwork!,
    payload: {
      amount: count,
      sourceAddress: sellOrder.payload.targetAddress,
      targetAddress: getAddress(seller, sell.sourceNetwork!),
      previousOwnerEntity: 'member',
      previousOwner: sell.owner,
      sourceTransaction: [sell.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid
    }
  }
  if (sell.fulfilled + count < sell.count || !balance) {
    return [billPayment]
  }
  const credit = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    member: sell.owner,
    network: sell.sourceNetwork,
    space: token.space,
    payload: {
      dependsOnBillPayment: true,
      amount: balance,
      sourceAddress: sellOrder.payload.targetAddress,
      targetAddress: getAddress(buyer, sell.sourceNetwork!),
      previousOwnerEntity: 'member',
      previousOwner: sell.owner,
      sourceTransaction: [sell.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid
    }
  }
  return [billPayment, credit]
}

const createRoyaltyPayment = async (sell: TokenTradeOrder, sellOrder: Transaction, seller: Member, spaceId: string, fee: number, info: INodeInfo) => {
  const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${spaceId}`).get()).data()
  const spaceAddress = getAddress(space, sell.sourceNetwork!)
  const sellerAddress = getAddress(seller, sell.sourceNetwork!)
  const output = packBasicOutput(spaceAddress, 0, undefined, info, sellerAddress)
  return <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: spaceId,
    member: sell.owner,
    network: sell.sourceNetwork,
    payload: {
      amount: Number(output.amount) + fee,
      storageReturn: {
        amount: Number(output.amount),
        address: sellerAddress,
      },
      sourceAddress: sellOrder.payload.targetAddress,
      targetAddress: spaceAddress,
      previousOwnerEntity: 'member',
      previousOwner: sell.owner,
      sourceTransaction: [sell.paymentTransactionId],
      royalty: true,
      void: false,
      token: sell.token
    }
  }
}

const createSmrPayments = async (
  token: Token,
  sell: TokenTradeOrder,
  buy: TokenTradeOrder,
  seller: Member,
  buyer: Member,
  count: number,
  isSell: boolean
): Promise<Transaction[]> => {
  const wallet = await WalletService.newWallet(buy.sourceNetwork!) as SmrWallet
  const tmpAddress = await wallet.getNewIotaAddressDetails(false)

  const totalSalePrice = Number(bigDecimal.floor(bigDecimal.multiply(count, isSell ? buy.price : sell.price)))
  let salePriceBalance = totalSalePrice
  const buyOrder = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`).get()).data()

  const royaltyFees = getRoyaltyFees(salePriceBalance)
  const royaltyPaymentPromises = Object.entries(royaltyFees).map(([space, fee]) => createRoyaltyPayment(buy, buyOrder, seller, space, fee, wallet.info))
  const royaltyPayments = await Promise.all(royaltyPaymentPromises)

  royaltyPayments.forEach(rp => { salePriceBalance -= rp.payload.amount })

  const output = packBasicOutput(tmpAddress.bech32, salePriceBalance, undefined, wallet.info)
  if (Number(output.amount) > salePriceBalance) {
    return []
  }
  const billPayment = <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    member: buy.owner,
    space: token.space,
    network: buy.sourceNetwork!,
    payload: {
      amount: salePriceBalance,
      sourceAddress: buyOrder.payload.targetAddress,
      targetAddress: getAddress(buyer, buy.sourceNetwork!),
      previousOwnerEntity: 'member',
      previousOwner: buy.owner,
      sourceTransaction: [buy.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid
    }
  }
  const balance = buy.balance - totalSalePrice
  const remainderOutput = packBasicOutput(tmpAddress.bech32, balance, undefined, wallet.info)
  if (balance !== 0 && Number(remainderOutput.amount) > balance) {
    return []
  }

  if (buy.fulfilled + count < buy.count || !balance) {
    return [...royaltyPayments, billPayment]
  }
  const credit = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    member: buy.owner,
    network: buy.sourceNetwork,
    space: token.space,
    payload: {
      dependsOnBillPayment: true,
      amount: balance,
      sourceAddress: buyOrder.payload.targetAddress,
      targetAddress: getAddress(buyer, buy.sourceNetwork!),
      previousOwnerEntity: 'member',
      previousOwner: buy.owner,
      sourceTransaction: [buy.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid
    }
  }
  return [...royaltyPayments, billPayment, credit]
}

const createPurchase = async (
  transaction: admin.firestore.Transaction,
  buy: TokenTradeOrder,
  sell: TokenTradeOrder,
  token: Token,
  isSell: boolean
) => {
  const tokensToTrade = Math.min(sell.count - sell.fulfilled, buy.count - buy.fulfilled);
  const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sell.owner}`).get()).data()
  const buyer = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buy.owner}`).get()).data()

  const iotaPayments = await createIotaPayments(token, sell, seller, buyer, tokensToTrade)
  const smrPayments = await createSmrPayments(token, sell, buy, seller, buyer, tokensToTrade, isSell)
  if (isEmpty(iotaPayments) || isEmpty(smrPayments)) {
    return { sellerCreditId: undefined, buyerCreditId: undefined, purchase: undefined }
  }
  [...iotaPayments, ...smrPayments].forEach((payment) => {
    const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${payment.uid}`)
    transaction.create(docRef, cOn(payment, URL_PATHS.TRANSACTION))
  })
  return {
    sellerCreditId: iotaPayments.find(o => o.type === TransactionType.CREDIT)?.uid,
    buyerCreditId: smrPayments.find(o => o.type === TransactionType.CREDIT)?.uid,
    purchase: <TokenPurchase>({
      uid: getRandomEthAddress(),
      token: buy.token,
      sell: sell.uid,
      buy: buy.uid,
      count: tokensToTrade,
      price: isSell ? buy.price : sell.price,
      createdOn: serverTime(),
      sourceNetwork: sell.sourceNetwork,
      targetNetwork: sell.targetNetwork,
      triggeredBy: isSell ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY,
      billPaymentId: iotaPayments.filter(o => o.type === TransactionType.BILL_PAYMENT)[0].uid,
      buyerBillPaymentId: smrPayments.filter(o => (o.type === TransactionType.BILL_PAYMENT && o.payload.royalty === false))[0].uid,
      royaltyBillPayments: smrPayments.filter(o => (o.type === TransactionType.BILL_PAYMENT && o.payload.royalty === true)).map(o => o.uid)
    })
  }
}

const updateTrade = (trade: TokenTradeOrder, purchase: TokenPurchase, creditTransactionId = '') => {
  const fulfilled = trade.fulfilled + purchase.count
  const salePrice = Number(bigDecimal.floor(bigDecimal.multiply(purchase.count, purchase.price)))
  const balance = trade.balance - (trade.type === TokenTradeOrderType.SELL ? purchase.count : salePrice)
  const status = trade.count === fulfilled ? TokenTradeOrderStatus.SETTLED : TokenTradeOrderStatus.ACTIVE
  return ({ ...trade, fulfilled, balance, status, creditTransactionId })
}

const fulfillSales = (tradeOrderId: string, startAfter: StartAfter | undefined) => admin.firestore().runTransaction(async (transaction) => {
  const tradeOrderDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${tradeOrderId}`)
  const tradeOrder = <TokenTradeOrder>(await transaction.get(tradeOrderDocRef)).data()
  if (tradeOrder.status !== TokenTradeOrderStatus.ACTIVE) {
    return;
  }
  const docs = (await getSaleQuery(tradeOrder, startAfter).get()).docs
  const trades = isEmpty(docs) ? [] : (await transaction.getAll(...docs.map(d => d.ref))).map(d => <TokenTradeOrder>d.data())
  const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${tradeOrder.token}`).get()).data()

  let update = cloneDeep(tradeOrder)
  for (const trade of trades) {
    const isSell = tradeOrder.type === TokenTradeOrderType.SELL
    const prevBuy = isSell ? trade : update
    const prevSell = isSell ? update : trade
    if ([prevBuy.status, prevSell.status].includes(TokenTradeOrderStatus.SETTLED)) {
      continue
    }
    const { purchase, sellerCreditId, buyerCreditId } = await createPurchase(transaction, prevBuy, prevSell, token, isSell)
    if (!purchase) {
      continue
    }
    const sell = updateTrade(prevSell, purchase, sellerCreditId)
    const buy = updateTrade(prevBuy, purchase, buyerCreditId)
    const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${trade.uid}`)
    transaction.update(docRef, uOn(isSell ? buy : sell))

    transaction.create(admin.firestore().doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`), purchase)
    update = isSell ? sell : buy
  }
  const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${tradeOrder.uid}`)
  transaction.update(docRef, uOn(update))

  return update.status === TokenTradeOrderStatus.SETTLED ? undefined : last(docs)
})

const getSaleQuery = (trade: TokenTradeOrder, startAfter: StartAfter | undefined) => {
  let query = admin.firestore().collection(COL.TOKEN_MARKET)
    .where('sourceNetwork', '==', trade.targetNetwork)
    .where('price', trade.type === TokenTradeOrderType.BUY ? '<=' : '>=', trade.price)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .orderBy('price', trade.type === TokenTradeOrderType.BUY ? 'asc' : 'desc')
    .orderBy('createdOn')
    .limit(TOKEN_SALE_ORDER_FETCH_LIMIT)
  if (startAfter) {
    query = query.startAfter(startAfter)
  }
  return query
}

