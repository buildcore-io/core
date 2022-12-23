import {
  COL,
  DEFAULT_NETWORK,
  Entity,
  Member,
  MIN_IOTA_AMOUNT,
  Space,
  SUB_COL,
  Token,
  TokenPurchase,
  TokenTradeOrder,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import bigDecimal from 'js-big-decimal';
import { isEmpty, tail } from 'lodash';
import admin from '../../admin.config';
import { getAddress } from '../../utils/address.utils';
import { cOn, uOn } from '../../utils/dateTime.utils';
import { getRoyaltyFees } from '../../utils/royalty.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Match } from './match-token';
import { getMemberTier, getTokenTradingFee } from './token-trade-order.trigger';

const createBuyPayments = async (
  token: Token,
  buy: TokenTradeOrder,
  sell: TokenTradeOrder,
  buyer: Member,
  seller: Member,
  tokensToTrade: number,
  price: number,
) => {
  let salePrice = Number(bigDecimal.floor(bigDecimal.multiply(tokensToTrade, price)));
  const fulfilled = buy.fulfilled + tokensToTrade === buy.count;
  const buyOrder = <Transaction>(
    (await admin.firestore().doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`).get()).data()
  );
  const royaltyFees = await getRoyaltyFees(salePrice, seller.tokenTradingFeePercentage);

  let balanceLeft = buy.balance - salePrice;
  if (balanceLeft < 0) {
    return [];
  }

  if (balanceLeft > 0 && balanceLeft < MIN_IOTA_AMOUNT) {
    if (!fulfilled) {
      return [];
    }
    royaltyFees[Object.keys(royaltyFees)[0]] += balanceLeft;
    salePrice += balanceLeft;
    balanceLeft = 0;
  }

  const royaltyPaymentPromises = Object.entries(royaltyFees)
    .filter((entry) => entry[1] > 0)
    .map(async ([space, fee]) => {
      const spaceData = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space}`).get()).data();
      return <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid: getRandomEthAddress(),
        space: token.space,
        member: buy.owner,
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
          quantity: tokensToTrade,
        },
        ignoreWallet: fee < MIN_IOTA_AMOUNT,
      };
    });
  const royaltyPayments = await Promise.all(royaltyPaymentPromises);
  royaltyPayments.forEach((p) => {
    salePrice -= p.ignoreWallet ? 0 : p.payload.amount;
  });
  if (salePrice < MIN_IOTA_AMOUNT) {
    return [];
  }
  const billPayment = <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: buy.owner,
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
      quantity: tokensToTrade,
    },
  };
  if (!fulfilled || !balanceLeft) {
    return [billPayment, ...royaltyPayments];
  }
  const credit = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: buy.owner,
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
      token: token.uid,
    },
  };
  return [billPayment, ...royaltyPayments, credit];
};

const updateSaleLock = (
  transaction: admin.firestore.Transaction,
  prev: TokenTradeOrder,
  sell: TokenTradeOrder,
) => {
  const diff = sell.fulfilled - prev.fulfilled;
  const docRef = admin
    .firestore()
    .doc(`${COL.TOKEN}/${sell.token}/${SUB_COL.DISTRIBUTION}/${sell.owner}`);
  const data = {
    lockedForSale: admin.firestore.FieldValue.increment(-diff),
    sold: admin.firestore.FieldValue.increment(diff),
    tokenOwned: admin.firestore.FieldValue.increment(-diff),
  };
  transaction.set(docRef, uOn(data), { merge: true });
};

const updateBuyerDistribution = (
  transaction: admin.firestore.Transaction,
  prev: TokenTradeOrder,
  buy: TokenTradeOrder,
) => {
  const diff = buy.fulfilled - prev.fulfilled;
  const docRef = admin
    .firestore()
    .doc(`${COL.TOKEN}/${buy.token}/${SUB_COL.DISTRIBUTION}/${buy.owner}`);
  const data = {
    totalPurchased: admin.firestore.FieldValue.increment(diff),
    tokenOwned: admin.firestore.FieldValue.increment(diff),
  };
  transaction.set(docRef, uOn(data), { merge: true });
};

export const matchSimpleToken = async (
  transaction: admin.firestore.Transaction,
  token: Token,
  buy: TokenTradeOrder,
  sell: TokenTradeOrder,
  price: number,
  triggeredBy: TokenTradeOrderType,
): Promise<Match> => {
  const tokensToTrade = Math.min(sell.count - sell.fulfilled, buy.count - buy.fulfilled);

  const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sell.owner}`).get()).data();
  const buyer = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buy.owner}`).get()).data();
  const buyerPayments = await createBuyPayments(
    token,
    buy,
    sell,
    buyer,
    seller,
    tokensToTrade,
    price,
  );

  if (isEmpty(buyerPayments)) {
    return { purchase: undefined, buyerCreditId: undefined, sellerCreditId: undefined };
  }
  buyerPayments.forEach((p) =>
    transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${p.uid}`), cOn(p)),
  );

  return {
    purchase: <TokenPurchase>{
      uid: getRandomEthAddress(),
      token: buy.token,
      tokenStatus: token.status,
      sell: sell.uid,
      buy: buy.uid,
      count: tokensToTrade,
      price,
      billPaymentId: buyerPayments[0].uid,
      royaltyBillPayments: tail(buyerPayments)
        .filter((p) => p.type !== TransactionType.CREDIT)
        .map((p) => p.uid),
      triggeredBy,

      sellerTier: await getMemberTier(seller),
      sellerTokenTradingFeePercentage: getTokenTradingFee(seller),
    },
    buyerCreditId: buyerPayments.filter((p) => p.type === TransactionType.CREDIT)[0]?.uid || '',
    sellerCreditId: undefined,
  };
};

export const updateSellLockAndDistribution = (
  transaction: admin.firestore.Transaction,
  prevBuy: TokenTradeOrder,
  buy: TokenTradeOrder,
  prevSell: TokenTradeOrder,
  sell: TokenTradeOrder,
) => {
  updateSaleLock(transaction, prevSell, sell);
  updateBuyerDistribution(transaction, prevBuy, buy);
};
