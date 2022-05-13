import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { Member, Transaction, TransactionCreditType, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenBuySellOrder, TokenBuySellOrderStatus, TokenBuySellOrderType, TokenPurchase } from '../../interfaces/models/token';
import admin from '../admin.config';
import { dateToTimestamp, serverTime, uOn } from '../utils/dateTime.utils';
import { memberDocRef } from '../utils/token.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';
import { guardedRerun } from './common.utils';


export const creditBuyer = async (buy: TokenBuySellOrder, newPurchase: TokenPurchase[], transaction: admin.firestore.Transaction) => {
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


export const cancelSale = async (transaction: admin.firestore.Transaction, sale: TokenBuySellOrder, forcedStatus?: TokenBuySellOrderStatus) => {
  const saleDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${sale.uid}`)
  const status = forcedStatus || (sale.fulfilled === 0 ? TokenBuySellOrderStatus.CANCELLED : TokenBuySellOrderStatus.PARTIALLY_SETTLED_AND_CANCELLED)

  transaction.update(saleDocRef, uOn({ status }))

  if (sale.type === TokenBuySellOrderType.SELL) {
    const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${sale.token}/${SUB_COL.DISTRIBUTION}/${sale.owner}`)
    transaction.update(distributionDocRef, uOn({ lockedForSale: 0 }))
  } else {
    await creditBuyer(sale, [], transaction)
  }

  return <TokenBuySellOrder>{ ...sale, status }
}

export const cancelExpiredSale = async () => {
  const runTransaction = () => admin.firestore().runTransaction(async (transaction) => {
    const query = admin.firestore().collection(COL.TOKEN_MARKET)
      .where('status', '==', TokenBuySellOrderStatus.ACTIVE)
      .where('expiresAt', '<=', dateToTimestamp(dayjs()))
      .orderBy('expiresAt')
      .limit(150)
    const docRefs = (await query.get()).docs.map(d => d.ref)
    const promises = (isEmpty(docRefs) ? [] : await transaction.getAll(...docRefs))
      .map(d => <TokenBuySellOrder>d.data())
      .filter(d => d.status === TokenBuySellOrderStatus.ACTIVE)
      .map(d => cancelSale(transaction, d, TokenBuySellOrderStatus.EXPIRED))

    return (await Promise.all(promises)).length
  })

  await guardedRerun(async () => await runTransaction() !== 0)
}
