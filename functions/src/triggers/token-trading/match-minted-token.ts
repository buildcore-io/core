import { INodeInfo } from "@iota/iota.js-next";
import { HexHelper } from "@iota/util.js-next";
import bigInt from "big-integer";
import bigDecimal from "js-big-decimal";
import { cloneDeep, isEmpty, last } from "lodash";
import { Member, Space, Transaction, TransactionType } from "../../../interfaces/models";
import { COL } from "../../../interfaces/models/base";
import { Token, TokenPurchase, TokenTradeOrder, TokenTradeOrderStatus, TokenTradeOrderType } from "../../../interfaces/models/token";
import admin from "../../admin.config";
import { SmrWallet } from "../../services/wallet/SmrWalletService";
import { WalletService } from "../../services/wallet/wallet";
import { getAddress } from "../../utils/address.utils";
import { packBasicOutput } from "../../utils/basic-output.utils";
import { guardedRerun } from "../../utils/common.utils";
import { serverTime, uOn } from '../../utils/dateTime.utils';
import { getRoyaltyFees } from "../../utils/token-trade.utils";
import { getRandomEthAddress } from "../../utils/wallet.utils";
import { getSaleQuery, StartAfter } from "./token-trade-order.trigger";

export const matchMintedToken = async (tradeOrderId: string) => {
  let startAfter: StartAfter | undefined = undefined
  await guardedRerun(async () => {
    startAfter = await fulfillSales(tradeOrderId, startAfter)
    return startAfter !== undefined
  }, 10000000)
}

const createRoyaltyBillPayments = async (
  token: Token,
  buy: TokenTradeOrder,
  seller: Member,
  buyer: Member,
  buyOrderTran: Transaction,
  sellPrice: number,
  info: INodeInfo
) => {
  const royaltyFees = getRoyaltyFees(sellPrice)
  const promises = Object.entries(royaltyFees).map(async ([spaceId, fee]) => {
    const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${spaceId}`).get()).data()
    const spaceAddress = getAddress(space, token.mintingData?.network!)
    const sellerAddress = getAddress(seller, token.mintingData?.network!)
    const output = packBasicOutput(spaceAddress, 0, undefined, info, sellerAddress)
    return <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      space: spaceId,
      member: buyer.uid,
      createdOn: serverTime(),
      network: token.mintingData?.network!,
      payload: {
        amount: Number(output.amount) + fee,
        storageReturn: {
          amount: Number(output.amount),
          address: sellerAddress,
        },
        sourceAddress: buyOrderTran.payload.targetAddress,
        targetAddress: spaceAddress,
        previousOwnerEntity: 'member',
        previousOwner: buyer.uid,
        sourceTransaction: [buy.paymentTransactionId],
        royalty: true,
        void: false,
        token: token.uid
      },
    }
  })

  return await Promise.all(promises)
}

const createBillPaymentToSeller = (
  token: Token,
  buyer: Member,
  seller: Member,
  buyOrderTran: Transaction,
  buy: TokenTradeOrder,
  salePrice: number,
  info: INodeInfo
) => {
  const sellerAddress = getAddress(seller, token.mintingData?.network!)
  const output = packBasicOutput(sellerAddress, salePrice, undefined, info)
  return <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: buyer.uid,
    createdOn: serverTime(),
    network: token.mintingData?.network!,
    payload: {
      amount: Number(output.amount),
      sourceAddress: buyOrderTran.payload.targetAddress,
      targetAddress: sellerAddress,
      previousOwnerEntity: 'member',
      previousOwner: buyer.uid,
      sourceTransaction: [buy.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid
    },
  }
}

const createBillPaymentToBuyer = (
  token: Token,
  buyer: Member,
  seller: Member,
  buyOrderTran: Transaction,
  sellOrderTran: Transaction,
  buy: TokenTradeOrder,
  sell: TokenTradeOrder,
  tokensToSell: number,
  info: INodeInfo
) => {
  const buyerAddress = getAddress(buyer, token.mintingData?.network!)
  const output = packBasicOutput(buyerAddress, 0, [{ id: token.mintingData?.tokenId!, amount: HexHelper.fromBigInt256(bigInt(tokensToSell)) }], info)
  return <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: seller.uid,
    createdOn: serverTime(),
    network: token.mintingData?.network!,
    payload: {
      amount: Number(output.amount),
      nativeTokens: [{ id: token.mintingData?.tokenId!, amount: tokensToSell }],
      sourceAddress: sellOrderTran.payload.targetAddress,
      storageDepositSourceAddress: buyOrderTran.payload.targetAddress,
      targetAddress: buyerAddress,
      previousOwnerEntity: 'member',
      previousOwner: seller.uid,
      sourceTransaction: [sell.paymentTransactionId, buy.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid
    },
  }
}

const createCreditToSeller = (token: Token, seller: Member, sell: TokenTradeOrder, sellOrderTran: Transaction) => {
  const sellerAddress = getAddress(seller, token.mintingData?.network!)
  return <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: seller.uid,
    createdOn: serverTime(),
    network: token.mintingData?.network!,
    payload: {
      dependsOnBillPayment: true,
      amount: sellOrderTran.payload.amount,
      sourceAddress: sellOrderTran.payload.targetAddress,
      targetAddress: sellerAddress,
      previousOwnerEntity: 'member',
      previousOwner: seller.uid,
      sourceTransaction: [sell.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid
    }
  }
}

const createCreditToBuyer = (token: Token, buyer: Member, buy: TokenTradeOrder, buyOrderTran: Transaction, amount: number) => {
  const buyerAddress = getAddress(buyer, token.mintingData?.network!)
  return <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: buyer.uid,
    createdOn: serverTime(),
    network: token.mintingData?.network!,
    payload: {
      dependsOnBillPayment: true,
      amount: amount,
      sourceAddress: buyOrderTran.payload.targetAddress,
      targetAddress: buyerAddress,
      previousOwnerEntity: 'member',
      previousOwner: buyer.uid,
      sourceTransaction: [buy.paymentTransactionId],
      royalty: false,
      void: false,
      token: token.uid
    }
  }
}

const createPurchase = async (
  transaction: admin.firestore.Transaction,
  buy: TokenTradeOrder,
  sell: TokenTradeOrder,
  token: Token,
  isSell: boolean
) => {
  const wallet = await WalletService.newWallet(token.mintingData?.network!) as SmrWallet
  const info = await wallet.client.info()

  const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sell.owner}`).get()).data()
  const buyer = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buy.owner}`).get()).data()

  const buyOrderTran = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`).get()).data()
  const sellOrderTran = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${sell.orderTransactionId}`).get()).data()

  const tokensToTrade = Math.min(sell.count - sell.fulfilled, buy.count - buy.fulfilled);

  let sellPrice = Number(bigDecimal.floor(bigDecimal.multiply(isSell ? buy.price : sell.price, tokensToTrade)))
  let balance = buy.balance

  const royaltyBillPayments = await createRoyaltyBillPayments(token, buy, seller, buyer, buyOrderTran, sellPrice, info)
  royaltyBillPayments.forEach(o => {
    balance -= o.payload.amount
    sellPrice -= o.payload.amount
  })

  const billPaymentToBuyer = createBillPaymentToBuyer(token, buyer, seller, buyOrderTran, sellOrderTran, buy, sell, tokensToTrade, info)
  balance -= billPaymentToBuyer.payload.amount
  sellPrice -= billPaymentToBuyer.payload.amount

  const billPaymentToSeller = createBillPaymentToSeller(token, buyer, seller, buyOrderTran, buy, sellPrice, info)
  balance -= billPaymentToSeller.payload.amount

  const buyerAddress = getAddress(buyer, token.mintingData?.network!)
  const remainder = packBasicOutput(buyerAddress, balance, undefined, info)
  if (balance !== 0 && balance !== Number(remainder.amount)) {
    return { sellerCreditId: undefined, buyerCreditId: undefined, purchase: undefined }
  }

  const creditToSeller = sell.fulfilled + tokensToTrade === sell.count ?
    createCreditToSeller(token, seller, sell, sellOrderTran) : undefined;

  const creditToBuyer = buy.fulfilled + tokensToTrade === buy.count && balance ?
    createCreditToBuyer(token, buyer, buy, buyOrderTran, balance) : undefined;

  [...royaltyBillPayments, billPaymentToSeller, billPaymentToBuyer, creditToSeller, creditToBuyer]
    .filter(t => t !== undefined)
    .forEach((data) => transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${data!.uid}`), data))

  return {
    sellerCreditId: creditToSeller?.uid,
    buyerCreditId: creditToBuyer?.uid,
    purchase: <TokenPurchase>({
      uid: getRandomEthAddress(),
      token: buy.token,
      sell: sell.uid,
      buy: buy.uid,
      count: tokensToTrade,
      price: isSell ? buy.price : sell.price,
      createdOn: serverTime(),
      triggeredBy: isSell ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY,
      billPaymentId: billPaymentToBuyer.uid,
      buyerBillPaymentId: billPaymentToSeller.uid,
      royaltyBillPayments: royaltyBillPayments.map(o => o.uid)
    })
  }
}

const updateTrde = (trade: TokenTradeOrder, purchase: TokenPurchase, creditTransactionId = '') => {
  const fulfilled = trade.fulfilled + purchase.count
  const status = trade.count === fulfilled ? TokenTradeOrderStatus.SETTLED : TokenTradeOrderStatus.ACTIVE
  const salePrice = bigDecimal.floor(bigDecimal.multiply(purchase.count, purchase.price))
  const balance = trade.balance - (trade.type === TokenTradeOrderType.SELL ? purchase.count : salePrice)
  return ({ ...trade, fulfilled, status, balance, creditTransactionId })
}

const fulfillSales = async (tradeOrderId: string, startAfter: StartAfter | undefined) => admin.firestore().runTransaction(async (transaction) => {
  const tradeOrderDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${tradeOrderId}`)
  const tradeOrder = <TokenTradeOrder>(await transaction.get(tradeOrderDocRef)).data()
  if (tradeOrder.status !== TokenTradeOrderStatus.ACTIVE) {
    return undefined;
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
    const sell = updateTrde(prevSell, purchase, sellerCreditId)
    const buy = updateTrde(prevBuy, purchase, buyerCreditId)
    const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${trade.uid}`)
    transaction.update(docRef, uOn(isSell ? buy : sell))

    transaction.create(admin.firestore().doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`), purchase)
    update = isSell ? sell : buy
  }

  const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${tradeOrder.uid}`)
  transaction.update(docRef, uOn(update))

  return update.status === TokenTradeOrderStatus.SETTLED ? undefined : last(docs)
})

