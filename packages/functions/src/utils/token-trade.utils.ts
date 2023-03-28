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
import { ITransaction } from '../firebase/firestore/interfaces';
import { soonDb } from '../firebase/firestore/soondb';
import { getAddress } from './address.utils';
import { getRandomEthAddress } from './wallet.utils';

export const creditBuyer = async (transaction: ITransaction, buy: TokenTradeOrder) => {
  const memberDocRef = soonDb().doc(`${COL.MEMBER}/${buy.owner}`);
  const member = (await memberDocRef.get<Member>())!;

  const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${buy.token}`);
  const token = (await tokenDocRef.get<Token>())!;

  const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`);
  const order = (await orderDocRef.get<Transaction>())!;

  const network = order.network || DEFAULT_NETWORK;
  const credit = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
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
  const creditDocRef = soonDb().doc(`${COL.TRANSACTION}/${credit.uid}`);
  transaction.create(creditDocRef, credit);

  const tradeOrderDocRef = soonDb().doc(`${COL.TOKEN_MARKET}/${buy.uid}`);
  transaction.update(tradeOrderDocRef, { creditTransactionId: credit.uid });
};

const creditBaseTokenSale = async (
  transaction: ITransaction,
  token: Token,
  sale: TokenTradeOrder,
) => {
  const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${sale.orderTransactionId}`);
  const order = (await orderDocRef.get<Transaction>())!;

  const memberDocRef = soonDb().doc(`${COL.MEMBER}/${sale.owner}`);
  const member = await memberDocRef.get<Member>();
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
  const creditDocRef = soonDb().doc(`${COL.TRANSACTION}/${data.uid}`);
  transaction.create(creditDocRef, data);

  const tradeDocRef = soonDb().doc(`${COL.TOKEN_MARKET}/${sale.uid}`);
  transaction.update(tradeDocRef, {
    creditTransactionId: data.uid,
    balance: 0,
  });
};

export const cancelTradeOrderUtil = async (
  transaction: ITransaction,
  tradeOrder: TokenTradeOrder,
  forcedStatus?: TokenTradeOrderStatus,
) => {
  const saleDocRef = soonDb().doc(`${COL.TOKEN_MARKET}/${tradeOrder.uid}`);
  const status =
    forcedStatus ||
    (tradeOrder.fulfilled === 0
      ? TokenTradeOrderStatus.CANCELLED
      : TokenTradeOrderStatus.PARTIALLY_SETTLED_AND_CANCELLED);
  const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${tradeOrder.token}`);
  const token = (await tokenDocRef.get<Token>())!;

  if (token.status === TokenStatus.BASE) {
    await creditBaseTokenSale(transaction, token, tradeOrder);
  } else if (tradeOrder.type === TokenTradeOrderType.SELL) {
    if (token.status === TokenStatus.MINTED) {
      await cancelMintedSell(transaction, tradeOrder, token);
    } else {
      const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(tradeOrder.owner);
      const leftForSale = bigDecimal.subtract(tradeOrder.count, tradeOrder.fulfilled);
      transaction.update(distributionDocRef, { lockedForSale: soonDb().inc(-Number(leftForSale)) });
    }
  } else {
    await creditBuyer(transaction, tradeOrder);
  }
  transaction.update(saleDocRef, { status });
  return <TokenTradeOrder>{ ...tradeOrder, status };
};

const cancelMintedSell = async (transaction: ITransaction, sell: TokenTradeOrder, token: Token) => {
  const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${sell.orderTransactionId}`);
  const order = (await orderDocRef.get<Transaction>())!;

  const sellerDocRef = soonDb().doc(`${COL.MEMBER}/${sell.owner}`);
  const seller = await sellerDocRef.get<Member>();

  const tokensLeft = sell.count - sell.fulfilled;
  const network = order.network || DEFAULT_NETWORK;
  const data = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: seller!.uid,
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
  const creditDocRef = soonDb().doc(`${COL.TRANSACTION}/${data.uid}`);
  transaction.create(creditDocRef, data);

  const tradeOrderDocRef = soonDb().doc(`${COL.TOKEN_MARKET}/${sell.uid}`);
  transaction.update(tradeOrderDocRef, { creditTransactionId: data.uid });
};
