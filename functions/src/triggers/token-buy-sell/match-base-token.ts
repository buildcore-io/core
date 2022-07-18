import { INodeInfo } from '@iota/iota.js-next';
import * as functions from 'firebase-functions';

import bigDecimal from "js-big-decimal";
import { isEmpty, last } from "lodash";
import { MIN_IOTA_AMOUNT, SECONDARY_TRANSACTION_DELAY, URL_PATHS } from "../../../interfaces/config";
import { Member, Space, Transaction, TransactionType } from "../../../interfaces/models";
import { COL } from "../../../interfaces/models/base";
import { TokenBuySellOrder, TokenBuySellOrderStatus, TokenBuySellOrderType, TokenPurchase } from "../../../interfaces/models/token";
import admin from "../../admin.config";
import { SmrWallet } from "../../services/wallet/SmrWalletService";
import { WalletService } from "../../services/wallet/wallet";
import { getAddress } from "../../utils/address.utils";
import { packBasicOutput } from "../../utils/basic-output.utils";
import { guardedRerun } from "../../utils/common.utils";
import { getRoyaltyPercentage, getRoyaltySpaces, getSpaceOneRoyaltyPercentage } from "../../utils/config.utils";
import { cOn, serverTime, uOn } from "../../utils/dateTime.utils";
import { getRandomEthAddress } from "../../utils/wallet.utils";
import { StartAfter, TOKEN_SALE_ORDER_FETCH_LIMIT } from "./token-buy-sell.trigger";

export const matchBaseToken = async (id: string, prev: TokenBuySellOrder | undefined, next: TokenBuySellOrder | undefined) => {
  if (prev === undefined || (!prev.shouldRetry && next?.shouldRetry)) {
    let startAfter: StartAfter | undefined = undefined
    await guardedRerun(async () => {
      startAfter = await fulfillSales(id, startAfter)
      return startAfter !== undefined
    }, 10000000)
    return;
  }
}

const createIotaPayments = async (sell: TokenBuySellOrder, buy: TokenBuySellOrder, seller: Member, buyer: Member, count: number): Promise<Transaction[]> => {
  const salePrice = Number(bigDecimal.floor(bigDecimal.multiply(count, sell.price)))
  if (salePrice < MIN_IOTA_AMOUNT) {
    return []
  }
  const balance = buy.balance - salePrice
  if (balance !== 0 && balance < MIN_IOTA_AMOUNT) {
    return []
  }
  const buyOrder = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`).get()).data()
  const network = buy.sourceNetwork!
  const billPayment = <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    member: buy.owner,
    sourceNetwork: network,
    targetNetwork: network,
    payload: {
      amount: salePrice,
      sourceAddress: buyOrder.payload.targetAddress,
      targetAddress: getAddress(seller.validatedAddress, network),
      previousOwnerEntity: 'member',
      previousOwner: buy.owner,
      sourceTransaction: [buy.paymentTransactionId],
      royalty: false,
      void: false,
    }
  }
  if (buy.fulfilled + count < buy.count || !balance) {
    return [billPayment]
  }
  const credit = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    member: buy.owner,
    sourceNetwork: network,
    targetNetwork: network,
    payload: {
      amount: balance,
      sourceAddress: buyOrder.payload.targetAddress,
      targetAddress: getAddress(buyer.validatedAddress, network),
      previousOwnerEntity: 'member',
      previousOwner: buy.owner,
      sourceTransaction: [buy.paymentTransactionId],
      royalty: false,
      void: false,
      delay: SECONDARY_TRANSACTION_DELAY
    }
  }
  return [billPayment, credit]
}

const createRoyaltyPayment = async (sell: TokenBuySellOrder, sellOrder: Transaction, spaceId: string, amount: number, info: INodeInfo) => {
  const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${spaceId}`).get()).data()
  const output = packBasicOutput(getAddress(space.validatedAddress, sell.sourceNetwork!), amount, undefined, info)
  return <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: spaceId,
    member: sell.owner,
    sourceNetwork: sell.sourceNetwork,
    targetNetwork: sell.sourceNetwork,
    payload: {
      amount: Math.min(Number(output.amount), amount),
      sourceAddress: sellOrder.payload.targetAddress,
      targetAddress: getAddress(space.validatedAddress, sell.sourceNetwork!),
      previousOwnerEntity: 'member',
      previousOwner: sell.owner,
      sourceTransaction: [sell.paymentTransactionId],
      royalty: true,
      void: false
    },
    ignoreWallet: Number(output.amount) > amount
  }
}

const getRoyaltyPayments = async (sell: TokenBuySellOrder, sellOrder: Transaction, salePrice: number, info: INodeInfo): Promise<Transaction[]> => {
  const percentage = getRoyaltyPercentage()
  const spaceOnePercentage = getSpaceOneRoyaltyPercentage()
  const royaltySpaces = getRoyaltySpaces()

  if (isNaN(percentage) || !percentage || isNaN(spaceOnePercentage) || !spaceOnePercentage || royaltySpaces.length !== 2) {
    functions.logger.error('Token sale config is missing');
    return []
  }
  const royaltyAmount = Number(bigDecimal.ceil(bigDecimal.multiply(salePrice, percentage / 100)))
  const royaltiesSpaceOne = Number(bigDecimal.ceil(bigDecimal.multiply(royaltyAmount, spaceOnePercentage / 100)))
  const royaltiesSpaceTwo = Number(bigDecimal.subtract(royaltyAmount, royaltiesSpaceOne))

  return [
    await createRoyaltyPayment(sell, sellOrder, royaltySpaces[0], royaltiesSpaceOne, info),
    await createRoyaltyPayment(sell, sellOrder, royaltySpaces[1], royaltiesSpaceTwo, info)
  ]
}

const createSmrPayments = async (sell: TokenBuySellOrder, buy: TokenBuySellOrder, buyer: Member, count: number): Promise<Transaction[]> => {
  const wallet = WalletService.newWallet(sell.sourceNetwork!) as SmrWallet
  const tmpAddress = await wallet.getNewIotaAddressDetails()
  const info = await wallet.client.info()

  const totalSalePrice = Number(bigDecimal.floor(bigDecimal.multiply(count, sell.price)))
  let salePriceBalance = totalSalePrice
  const sellOrder = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${sell.orderTransactionId}`).get()).data()
  const royaltyPayments = await getRoyaltyPayments(sell, sellOrder, salePriceBalance, info)
  royaltyPayments.filter(rp => !rp.ignoreWallet).forEach(rp => {
    salePriceBalance -= rp.payload.amount
  })

  const output = packBasicOutput(tmpAddress.bech32, salePriceBalance, undefined, info)
  if (Number(output.amount) > salePriceBalance) {
    return []
  }
  const billPayment = <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    member: sell.owner,
    sourceNetwork: sell.sourceNetwork!,
    targetNetwork: sell.sourceNetwork!,
    payload: {
      amount: salePriceBalance,
      sourceAddress: sellOrder.payload.targetAddress,
      targetAddress: getAddress(buyer.validatedAddress, sell.sourceNetwork!),
      previousOwnerEntity: 'member',
      previousOwner: sell.owner,
      sourceTransaction: [sell.paymentTransactionId],
      royalty: false,
      void: false
    }
  }
  const balance = sell.balance - totalSalePrice
  const remainderOutput = packBasicOutput(tmpAddress.bech32, balance, undefined, info)
  if (balance !== 0 && Number(remainderOutput.amount) > balance) {
    return []
  }
  return [...royaltyPayments, billPayment].map((p, i) => p.ignoreWallet ? p : ({ ...p, payload: { ...p.payload, delay: SECONDARY_TRANSACTION_DELAY * i } }))
}

const createPurchase = async (transaction: admin.firestore.Transaction, buy: TokenBuySellOrder, sell: TokenBuySellOrder) => {
  const tokensToTrade = Math.min(sell.count - sell.fulfilled, buy.count - buy.fulfilled);
  const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sell.owner}`).get()).data()
  const buyer = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buy.owner}`).get()).data()

  const iotaPayments = await createIotaPayments(sell, buy, seller, buyer, tokensToTrade)
  const smrPayments = await createSmrPayments(sell, buy, buyer, tokensToTrade)
  if (isEmpty(iotaPayments) || isEmpty(smrPayments)) {
    return;
  }
  [...iotaPayments, ...smrPayments].forEach((payment) => {
    const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${payment.uid}`)
    transaction.create(docRef, cOn(payment, URL_PATHS.TRANSACTION))
  })
  return <TokenPurchase>({
    uid: getRandomEthAddress(),
    token: buy.token,
    sell: sell.uid,
    buy: buy.uid,
    count: tokensToTrade,
    price: sell.price,
    createdOn: serverTime(),
    sourceNetwork: sell.sourceNetwork,
    targetNetwork: sell.targetNetwork
  })
}

const updateSale = (sale: TokenBuySellOrder, purchase: TokenPurchase) => {
  const fulfilled = sale.fulfilled + purchase.count
  const purchaseAmount = bigDecimal.floor(bigDecimal.multiply(purchase.count, purchase.price))
  const salePrice = Number(bigDecimal.subtract(sale.balance, purchaseAmount))
  const balance = sale.totalDeposit - salePrice
  const status = sale.count === fulfilled ? TokenBuySellOrderStatus.SETTLED : TokenBuySellOrderStatus.ACTIVE
  return ({ ...sale, fulfilled, balance, status })
}

const fulfillSales = (docId: string, startAfter: StartAfter | undefined) => admin.firestore().runTransaction(async (transaction) => {
  const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${docId}`)
  const doc = <TokenBuySellOrder>(await transaction.get(docRef)).data()
  if (doc?.status !== TokenBuySellOrderStatus.ACTIVE) {
    return
  }
  const docs = (await getSaleQuery(doc, startAfter).get()).docs
  const sales = docs.length ? (await transaction.getAll(...docs.map(d => d.ref))).map(d => <TokenBuySellOrder>d.data()) : []

  let update = { ...doc }
  for (const b of sales) {
    const isSell = doc.type === TokenBuySellOrderType.SELL
    const prevBuy = isSell ? b : update
    const prevSell = isSell ? update : b
    if ([prevBuy.status, prevSell.status].includes(TokenBuySellOrderStatus.SETTLED)) {
      continue
    }
    const purchase = await createPurchase(transaction, prevBuy, prevSell)
    if (!purchase) {
      continue
    }
    const sell = updateSale(prevSell, purchase)
    const buy = updateSale(prevBuy, purchase)
    const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${b.uid}`)
    transaction.update(docRef, uOn(isSell ? buy : sell))

    transaction.create(admin.firestore().doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`), purchase)
    update = isSell ? sell : buy
  }

  transaction.update(docRef, uOn({ ...update, shouldRetry: false }))
  const lastDoc = last(docs)
  return update.status === TokenBuySellOrderStatus.SETTLED ? undefined : lastDoc
})

const getSaleQuery = (sale: TokenBuySellOrder, startAfter: StartAfter | undefined) => {
  let query = admin.firestore().collection(COL.TOKEN_MARKET)
    .where('sourceNetwork', '==', sale.targetNetwork)
    .where('price', sale.type === TokenBuySellOrderType.BUY ? '<=' : '>=', sale.price)
    .where('status', '==', TokenBuySellOrderStatus.ACTIVE)
    .orderBy('price')
    .orderBy('createdOn')
    .limit(TOKEN_SALE_ORDER_FETCH_LIMIT)
  if (startAfter) {
    query = query.startAfter(startAfter)
  }
  return query
}

