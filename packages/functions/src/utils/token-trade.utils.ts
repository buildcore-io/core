import {
  COL,
  CreditPaymentReason,
  DEFAULT_NETWORK,
  Member,
  SUB_COL,
  Token,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  TransactionCreditType,
  TransactionType,
} from '@soonaverse/interfaces';
import bigDecimal from 'js-big-decimal';
import admin from '../admin.config';
import { getAddress } from './address.utils';
import { cOn, uOn } from './dateTime.utils';
import { memberDocRef } from './token.utils';
import { getRandomEthAddress } from './wallet.utils';

export const creditBuyer = async (
  buy: TokenTradeOrder,
  transaction: admin.firestore.Transaction,
) => {
  const member = <Member>(await memberDocRef(buy.owner).get()).data();
  const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${buy.token}`).get()).data();
  const order = <Transaction>(
    (await admin.firestore().doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`).get()).data()
  );
  const tranId = getRandomEthAddress();
  const network = order.network || DEFAULT_NETWORK;
  const data = <Transaction>{
    type: TransactionType.CREDIT,
    uid: tranId,
    space: token.space,
    member: member.uid,
    network,
    payload: {
      reason: CreditPaymentReason.TRADE_CANCELLED,
      type: TransactionCreditType.TOKEN_BUY,
      amount: buy.balance,
      sourceAddress: order.payload.targetAddress,
      targetAddress: getAddress(member, network),
      sourceTransaction: [buy.paymentTransactionId],
      reconciled: true,
      void: false,
      token: token.uid,
      tokenSymbol: token.symbol,
    },
  };
  const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${tranId}`);
  transaction.create(docRef, cOn(data));
  transaction.update(
    admin.firestore().doc(`${COL.TOKEN_MARKET}/${buy.uid}`),
    uOn({ creditTransactionId: tranId }),
  );
};

const creditBaseTokenSale = async (
  transaction: admin.firestore.Transaction,
  token: Token,
  sale: TokenTradeOrder,
) => {
  const order = <Transaction>(
    (await admin.firestore().doc(`${COL.TRANSACTION}/${sale.orderTransactionId}`).get()).data()
  );
  const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sale.owner}`).get()).data();
  const network = order.network || DEFAULT_NETWORK;
  const data = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: '',
    member: sale.owner,
    network,
    payload: {
      reason: CreditPaymentReason.TRADE_CANCELLED,
      type: TransactionCreditType.TOKEN_BUY,
      amount: sale.balance,
      sourceAddress: order.payload.targetAddress,
      targetAddress: getAddress(member, network),
      sourceTransaction: [sale.paymentTransactionId],
      reconciled: true,
      void: false,
      token: token.uid,
      tokenSymbol: token.symbol,
    },
  };
  transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), cOn(data));
  transaction.update(
    admin.firestore().doc(`${COL.TOKEN_MARKET}/${sale.uid}`),
    uOn({
      creditTransactionId: data.uid,
      balance: 0,
    }),
  );
};

export const cancelTradeOrderUtil = async (
  transaction: admin.firestore.Transaction,
  tradeOrder: TokenTradeOrder,
  forcedStatus?: TokenTradeOrderStatus,
) => {
  const saleDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${tradeOrder.uid}`);
  const status =
    forcedStatus ||
    (tradeOrder.fulfilled === 0
      ? TokenTradeOrderStatus.CANCELLED
      : TokenTradeOrderStatus.PARTIALLY_SETTLED_AND_CANCELLED);
  const token = <Token>(
    (await admin.firestore().doc(`${COL.TOKEN}/${tradeOrder.token}`).get()).data()
  );

  if (token.status === TokenStatus.BASE) {
    await creditBaseTokenSale(transaction, token, tradeOrder);
  } else if (tradeOrder.type === TokenTradeOrderType.SELL) {
    if (token.status === TokenStatus.MINTED) {
      await cancelMintedSell(transaction, tradeOrder, token);
    } else {
      const distributionDocRef = admin
        .firestore()
        .doc(`${COL.TOKEN}/${tradeOrder.token}/${SUB_COL.DISTRIBUTION}/${tradeOrder.owner}`);
      const leftForSale = bigDecimal.subtract(tradeOrder.count, tradeOrder.fulfilled);
      transaction.update(
        distributionDocRef,
        uOn({ lockedForSale: admin.firestore.FieldValue.increment(-Number(leftForSale)) }),
      );
    }
  } else {
    await creditBuyer(tradeOrder, transaction);
  }
  transaction.update(saleDocRef, uOn({ status }));
  return <TokenTradeOrder>{ ...tradeOrder, status };
};

const cancelMintedSell = async (
  transaction: admin.firestore.Transaction,
  sell: TokenTradeOrder,
  token: Token,
) => {
  const order = <Transaction>(
    (await admin.firestore().doc(`${COL.TRANSACTION}/${sell.orderTransactionId}`).get()).data()
  );
  const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sell.owner}`).get()).data();
  const tokensLeft = sell.count - sell.fulfilled;
  const network = order.network || DEFAULT_NETWORK;
  const data = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: seller.uid,
    network,
    payload: {
      reason: CreditPaymentReason.TRADE_CANCELLED,
      type: TransactionCreditType.TOKEN_BUY,
      amount: order.payload.amount,
      nativeTokens: [{ amount: tokensLeft, id: token.mintingData?.tokenId! }],
      sourceAddress: order.payload.targetAddress,
      targetAddress: getAddress(seller, network),
      sourceTransaction: [sell.paymentTransactionId],
      reconciled: true,
      void: false,
      token: token.uid,
      tokenSymbol: token.symbol,
    },
  };
  transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), cOn(data));
  transaction.update(
    admin.firestore().doc(`${COL.TOKEN_MARKET}/${sell.uid}`),
    uOn({ creditTransactionId: data.uid }),
  );
};
