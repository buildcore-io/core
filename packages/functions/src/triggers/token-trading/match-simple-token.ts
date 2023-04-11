import {
  BillPaymentType,
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
  TransactionCreditType,
  TransactionType,
} from '@soonaverse/interfaces';
import bigDecimal from 'js-big-decimal';
import { isEmpty, tail } from 'lodash';
import { ITransaction } from '../../firebase/firestore/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { getAddress } from '../../utils/address.utils';
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
  const buyOrder = (await soonDb()
    .doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`)
    .get<Transaction>())!;
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
      const spaceData = await soonDb().doc(`${COL.SPACE}/${space}`).get<Space>();
      return <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid: getRandomEthAddress(),
        space: token.space,
        member: buy.owner,
        network: buy.targetNetwork || DEFAULT_NETWORK,
        payload: {
          type: BillPaymentType.PRE_MINTED_TOKEN_TRADE,
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
          quantity: tokensToTrade,
          token: token.uid,
          tokenSymbol: token.symbol,
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
      type: BillPaymentType.PRE_MINTED_TOKEN_TRADE,
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
      quantity: tokensToTrade,
      token: token.uid,
      tokenSymbol: token.symbol,
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
      type: TransactionCreditType.TOKEN_TRADE_FULLFILLMENT,
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
      tokenSymbol: token.symbol,
    },
  };
  return [billPayment, ...royaltyPayments, credit];
};

const updateSaleLock = (
  transaction: ITransaction,
  prev: TokenTradeOrder,
  sell: TokenTradeOrder,
) => {
  const diff = sell.fulfilled - prev.fulfilled;
  const docRef = soonDb().doc(`${COL.TOKEN}/${sell.token}/${SUB_COL.DISTRIBUTION}/${sell.owner}`);
  const data = {
    lockedForSale: soonDb().inc(-diff),
    sold: soonDb().inc(diff),
    tokenOwned: soonDb().inc(-diff),
  };
  transaction.set(docRef, data, true);
};

const updateBuyerDistribution = (
  transaction: ITransaction,
  prev: TokenTradeOrder,
  buy: TokenTradeOrder,
) => {
  const diff = buy.fulfilled - prev.fulfilled;
  const docRef = soonDb().doc(`${COL.TOKEN}/${buy.token}/${SUB_COL.DISTRIBUTION}/${buy.owner}`);
  const data = {
    totalPurchased: soonDb().inc(diff),
    tokenOwned: soonDb().inc(diff),
  };
  transaction.set(docRef, data, true);
};

export const matchSimpleToken = async (
  transaction: ITransaction,
  token: Token,
  buy: TokenTradeOrder,
  sell: TokenTradeOrder,
  price: number,
  triggeredBy: TokenTradeOrderType,
): Promise<Match> => {
  const tokensToTrade = Math.min(sell.count - sell.fulfilled, buy.count - buy.fulfilled);

  const seller = (await soonDb().doc(`${COL.MEMBER}/${sell.owner}`).get<Member>())!;
  const buyer = (await soonDb().doc(`${COL.MEMBER}/${buy.owner}`).get<Member>())!;
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
  buyerPayments.forEach((p) => transaction.create(soonDb().doc(`${COL.TRANSACTION}/${p.uid}`), p));

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
  transaction: ITransaction,
  prevBuy: TokenTradeOrder,
  buy: TokenTradeOrder,
  prevSell: TokenTradeOrder,
  sell: TokenTradeOrder,
) => {
  updateSaleLock(transaction, prevSell, sell);
  updateBuyerDistribution(transaction, prevBuy, buy);
};
