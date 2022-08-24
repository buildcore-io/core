import * as functions from 'firebase-functions';
import bigDecimal from 'js-big-decimal';
import { DEFAULT_NETWORK } from '../../interfaces/config';
import { Member, Transaction, TransactionCreditType, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenStatus, TokenTradeOrder, TokenTradeOrderStatus, TokenTradeOrderType } from '../../interfaces/models/token';
import admin from '../admin.config';
import { getAddress } from './address.utils';
import { getRoyaltyPercentage, getRoyaltySpaces, getSpaceOneRoyaltyPercentage } from './config.utils';
import { serverTime, uOn } from './dateTime.utils';
import { memberDocRef } from './token.utils';
import { getRandomEthAddress } from './wallet.utils';

export const creditBuyer = async (buy: TokenTradeOrder, transaction: admin.firestore.Transaction) => {
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
    sourceNetwork: order.sourceNetwork || DEFAULT_NETWORK,
    targetNetwork: order.targetNetwork || DEFAULT_NETWORK,
    payload: {
      type: TransactionCreditType.TOKEN_BUY,
      amount: buy.balance,
      sourceAddress: order.payload.targetAddress,
      targetAddress: getAddress(member, order.targetNetwork || DEFAULT_NETWORK),
      sourceTransaction: [buy.paymentTransactionId],
      token: token.uid,
      reconciled: true,
      void: false,
      invalidPayment: true
    }
  };
  const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${tranId}`)
  transaction.create(docRef, data)
  transaction.update(admin.firestore().doc(`${COL.TOKEN_MARKET}/${buy.uid}`), uOn({ creditTransactionId: tranId }))
}

const creditBaseTokenSale = async (transaction: admin.firestore.Transaction, sale: TokenTradeOrder) => {
  const order = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${sale.orderTransactionId}`).get()).data()
  const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sale.owner}`).get()).data()
  const data = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: '',
    member: sale.owner,
    createdOn: serverTime(),
    sourceNetwork: sale.sourceNetwork!,
    targetNetwork: sale.sourceNetwork!,
    payload: {
      type: TransactionCreditType.TOKEN_BUY,
      amount: sale.balance,
      sourceAddress: order.payload.targetAddress,
      targetAddress: getAddress(member, order.sourceNetwork!),
      sourceTransaction: [sale.paymentTransactionId],
      token: '',
      reconciled: true,
      void: false,
      invalidPayment: true
    }
  }
  transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), data)
  transaction.update(admin.firestore().doc(`${COL.TOKEN_MARKET}/${sale.uid}`), { creditTransactionId: data.uid, balance: 0 })
}

export const cancelTradeOrderUtil = async (transaction: admin.firestore.Transaction, tradeOrder: TokenTradeOrder, forcedStatus?: TokenTradeOrderStatus) => {
  const saleDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${tradeOrder.uid}`)
  const status = forcedStatus || (tradeOrder.fulfilled === 0 ? TokenTradeOrderStatus.CANCELLED : TokenTradeOrderStatus.PARTIALLY_SETTLED_AND_CANCELLED)
  const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${tradeOrder.token}`).get()).data()

  if (token.status === TokenStatus.BASE) {
    await creditBaseTokenSale(transaction, tradeOrder)
  } else if (tradeOrder.type === TokenTradeOrderType.SELL) {
    if (token.status === TokenStatus.MINTED) {
      await cancelMintedSell(transaction, tradeOrder, token)
    } else {
      const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${tradeOrder.token}/${SUB_COL.DISTRIBUTION}/${tradeOrder.owner}`)
      const leftForSale = bigDecimal.subtract(tradeOrder.count, tradeOrder.fulfilled)
      transaction.update(distributionDocRef, uOn({ lockedForSale: admin.firestore.FieldValue.increment(-Number(leftForSale)) }))
    }
  } else {
    await creditBuyer(tradeOrder, transaction)
  }
  transaction.update(saleDocRef, uOn({ status }))
  return <TokenTradeOrder>{ ...tradeOrder, status }
}

const cancelMintedSell = async (transaction: admin.firestore.Transaction, sell: TokenTradeOrder, token: Token) => {
  const sellOrderTran = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${sell.orderTransactionId}`).get()).data()
  const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sell.owner}`).get()).data()
  const tokensLeft = sell.count - sell.fulfilled
  const data = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: seller.uid,
    createdOn: serverTime(),
    sourceNetwork: sellOrderTran.sourceNetwork || DEFAULT_NETWORK,
    targetNetwork: sellOrderTran.targetNetwork || DEFAULT_NETWORK,
    payload: {
      type: TransactionCreditType.TOKEN_BUY,
      amount: sellOrderTran.payload.amount,
      nativeTokens: [{ amount: tokensLeft, id: token.mintingData?.tokenId! }],
      sourceAddress: sellOrderTran.payload.targetAddress,
      targetAddress: getAddress(seller, token.mintingData?.network!),
      sourceTransaction: [sell.paymentTransactionId],
      token: token.uid,
      reconciled: true,
      void: false,
      invalidPayment: true
    }
  };
  transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), data)
  transaction.update(admin.firestore().doc(`${COL.TOKEN_MARKET}/${sell.uid}`), uOn({ creditTransactionId: data.uid }))
}


export const getRoyaltyFees = (amount: number) => {
  const percentage = getRoyaltyPercentage()
  const spaceOnePercentage = getSpaceOneRoyaltyPercentage()
  const royaltySpaces = getRoyaltySpaces()
  if (isNaN(percentage) || !percentage || isNaN(spaceOnePercentage) || !spaceOnePercentage || royaltySpaces.length !== 2) {
    functions.logger.error('Token sale config is missing');
    return {}
  }

  const royaltyAmount = Number(bigDecimal.ceil(bigDecimal.multiply(amount, percentage / 100)))
  const royaltiesSpaceOne = Number(bigDecimal.ceil(bigDecimal.multiply(royaltyAmount, spaceOnePercentage / 100)))
  const royaltiesSpaceTwo = Number(bigDecimal.subtract(royaltyAmount, royaltiesSpaceOne))
  return { [royaltySpaces[0]]: royaltiesSpaceOne, [royaltySpaces[1]]: royaltiesSpaceTwo }
}
