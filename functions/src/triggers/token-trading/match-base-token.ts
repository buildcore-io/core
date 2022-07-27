import { INodeInfo } from '@iota/iota.js-next';

import bigDecimal from "js-big-decimal";
import { cloneDeep, isEmpty, last } from "lodash";
import { MIN_IOTA_AMOUNT, URL_PATHS } from "../../../interfaces/config";
import { Member, Space, Transaction, TransactionType } from "../../../interfaces/models";
import { COL } from "../../../interfaces/models/base";
import { TokenPurchase, TokenTradeOrder, TokenTradeOrderStatus, TokenTradeOrderType } from "../../../interfaces/models/token";
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

const createIotaPayments = async (sell: TokenTradeOrder, buy: TokenTradeOrder, seller: Member, buyer: Member, count: number): Promise<Transaction[]> => {
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
      targetAddress: getAddress(seller, network),
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
      targetAddress: getAddress(buyer, network),
      previousOwnerEntity: 'member',
      previousOwner: buy.owner,
      sourceTransaction: [buy.paymentTransactionId],
      royalty: false,
      void: false
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
    sourceNetwork: sell.sourceNetwork,
    targetNetwork: sell.sourceNetwork,
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
      void: false
    }
  }
}

const createSmrPayments = async (sell: TokenTradeOrder, seller: Member, buyer: Member, count: number): Promise<Transaction[]> => {
  const wallet = WalletService.newWallet(sell.sourceNetwork!) as SmrWallet
  const tmpAddress = await wallet.getNewIotaAddressDetails()
  const info = await wallet.client.info()

  const totalSalePrice = Number(bigDecimal.floor(bigDecimal.multiply(count, sell.price)))
  let salePriceBalance = totalSalePrice
  const sellOrder = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${sell.orderTransactionId}`).get()).data()

  const royaltyFees = getRoyaltyFees(salePriceBalance)
  const royaltyPaymentPromises = Object.entries(royaltyFees).map(([space, fee]) => createRoyaltyPayment(sell, sellOrder, seller, space, fee, info))
  const royaltyPayments = await Promise.all(royaltyPaymentPromises)

  royaltyPayments.forEach(rp => { salePriceBalance -= rp.payload.amount })

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
      targetAddress: getAddress(buyer, sell.sourceNetwork!),
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
  return [...royaltyPayments, billPayment]
}

const createPurchase = async (transaction: admin.firestore.Transaction, buy: TokenTradeOrder, sell: TokenTradeOrder) => {
  const tokensToTrade = Math.min(sell.count - sell.fulfilled, buy.count - buy.fulfilled);
  const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sell.owner}`).get()).data()
  const buyer = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buy.owner}`).get()).data()

  const iotaPayments = await createIotaPayments(sell, buy, seller, buyer, tokensToTrade)
  const smrPayments = await createSmrPayments(sell, seller, buyer, tokensToTrade)
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

const updateSale = (sale: TokenTradeOrder, purchase: TokenPurchase) => {
  const fulfilled = sale.fulfilled + purchase.count
  const purchaseAmount = bigDecimal.floor(bigDecimal.multiply(purchase.count, purchase.price))
  const salePrice = Number(bigDecimal.subtract(sale.balance, purchaseAmount))
  const balance = sale.totalDeposit - salePrice
  const status = sale.count === fulfilled ? TokenTradeOrderStatus.SETTLED : TokenTradeOrderStatus.ACTIVE
  return ({ ...sale, fulfilled, balance, status })
}

const fulfillSales = (tradeOrderId: string, startAfter: StartAfter | undefined) => admin.firestore().runTransaction(async (transaction) => {
  const tradeOrderDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${tradeOrderId}`)
  const tradeOrder = <TokenTradeOrder>(await transaction.get(tradeOrderDocRef)).data()
  if (tradeOrder.status !== TokenTradeOrderStatus.ACTIVE) {
    return;
  }
  const docs = (await getSaleQuery(tradeOrder, startAfter).get()).docs
  const trades = isEmpty(docs) ? [] : (await transaction.getAll(...docs.map(d => d.ref))).map(d => <TokenTradeOrder>d.data())

  let update = cloneDeep(tradeOrder)
  for (const trade of trades) {
    const isSell = tradeOrder.type === TokenTradeOrderType.SELL
    const prevBuy = isSell ? trade : update
    const prevSell = isSell ? update : trade
    if ([prevBuy.status, prevSell.status].includes(TokenTradeOrderStatus.SETTLED)) {
      continue
    }
    const purchase = await createPurchase(transaction, prevBuy, prevSell)
    if (!purchase) {
      continue
    }
    const sell = updateSale(prevSell, purchase)
    const buy = updateSale(prevBuy, purchase)
    const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${trade.uid}`)
    transaction.update(docRef, uOn(isSell ? buy : sell))

    transaction.create(admin.firestore().doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`), purchase)
    update = isSell ? sell : buy
  }
  const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${tradeOrder.uid}`)
  transaction.update(docRef, uOn(update))

  return update.status === TokenTradeOrderStatus.SETTLED ? undefined : last(docs)
})

const getSaleQuery = (sale: TokenTradeOrder, startAfter: StartAfter | undefined) => {
  let query = admin.firestore().collection(COL.TOKEN_MARKET)
    .where('sourceNetwork', '==', sale.targetNetwork)
    .where('price', sale.type === TokenTradeOrderType.BUY ? '<=' : '>=', sale.price)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .orderBy('price')
    .orderBy('createdOn')
    .limit(TOKEN_SALE_ORDER_FETCH_LIMIT)
  if (startAfter) {
    query = query.startAfter(startAfter)
  }
  return query
}

