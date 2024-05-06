import { database } from '@buildcore/database';
import {
  COL,
  CreditPaymentReason,
  DEFAULT_NETWORK,
  MIN_IOTA_AMOUNT,
  Member,
  Network,
  NetworkAddress,
  SOON_PROJECT_ID,
  SUB_COL,
  SYSTEM_CONFIG_DOC_ID,
  TOKEN_SALE_TEST,
  Token,
  TokenDistribution,
  TokenPurchase,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import bigDecimal from 'js-big-decimal';
import { isEmpty } from 'lodash';
import { TOKEN_TRADE_ORDER_FETCH_LIMIT } from '../../src/triggers/token-trading/match-token';
import { getAddress } from '../../src/utils/address.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { mockWalletReturnValue, soonTokenId, testEnv } from '../set-up';
import { createRoyaltySpaces, getRandomSymbol, submitMilestoneFunc, wait } from './common';

const buyTokenFunc = async (memberAddress: NetworkAddress, request: any) => {
  mockWalletReturnValue(memberAddress, { ...request, type: TokenTradeOrderType.BUY });
  const order = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
  await submitMilestoneFunc(
    order,
    Number(bigDecimal.floor(bigDecimal.multiply(request.price, request.count))),
  );
  return order;
};
const assertVolumeTotal = async (tokenId: string, volumeTotal: number) => {
  const statDoc = database().doc(COL.TOKEN, tokenId, SUB_COL.STATS, tokenId);
  await wait(async () => (await statDoc.get())?.volumeTotal === volumeTotal);
};
const getBillPayments = (member: string) =>
  database()
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.BILL_PAYMENT)
    .where('member', '==', member)
    .get();
const { percentage, spaceonepercentage } = TOKEN_SALE_TEST;
const getRoyaltyDistribution = (amount: number) => {
  const spaceOne = amount * (percentage / 100) * (spaceonepercentage / 100);
  const spaceTwo = amount * (percentage / 100) * (1 - spaceonepercentage / 100);
  return [
    spaceOne,
    spaceTwo,
    amount -
      (spaceOne >= MIN_IOTA_AMOUNT ? spaceOne : 0) -
      (spaceTwo >= MIN_IOTA_AMOUNT ? spaceTwo : 0),
  ];
};

describe('Trade trigger', () => {
  let seller: string;
  let buyer: string;
  let token: Token;
  const tokenCount = 400;
  const saveSellToDb = async (count: number, price: number) => {
    const data = <TokenTradeOrder>{
      project: SOON_PROJECT_ID,
      createdOn: serverTime(),
      uid: wallet.getRandomEthAddress(),
      owner: seller,
      token: token.uid,
      type: TokenTradeOrderType.SELL,
      count: count,
      price: price,
      totalDeposit: count * price,
      balance: 0,
      expiresAt: serverTime(),
      fulfilled: 0,
      status: TokenTradeOrderStatus.ACTIVE,
    };
    await database().doc(COL.TOKEN_MARKET, data.uid).create(data);
  };

  beforeAll(async () => {
    await createRoyaltySpaces();
  });

  beforeEach(async () => {
    seller = await testEnv.createMember();
    buyer = await testEnv.createMember();
    const tokenId = wallet.getRandomEthAddress();
    const tokenUpsert = {
      project: SOON_PROJECT_ID,
      uid: tokenId,
      symbol: getRandomSymbol(),
      name: 'MyToken',
      space: 'myspace',
      status: TokenStatus.PRE_MINTED,
      approved: true,
    };
    await database().doc(COL.TOKEN, tokenId).upsert(tokenUpsert);
    token = (await database().doc(COL.TOKEN, tokenId).get())!;
    const distribution = { tokenOwned: tokenCount * 3 };
    await database().doc(COL.TOKEN, tokenId, SUB_COL.DISTRIBUTION, seller).upsert(distribution);
    await database()
      .doc(COL.SYSTEM, SYSTEM_CONFIG_DOC_ID)
      .upsert({ tokenTradingFeePercentage: undefined });
  });

  it('Should fulfill buy with one sell', async () => {
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    const request = { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: tokenCount };
    const order = await buyTokenFunc(buyer, request);
    await wait(async () => {
      const buySnap = await database()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY)
        .where('owner', '==', buyer)
        .get();
      return buySnap[0].fulfilled === tokenCount;
    });
    const buySnap = await database()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.BUY)
      .where('owner', '==', buyer)
      .get();
    expect(buySnap.length).toBe(1);
    const buy = <TokenTradeOrder>buySnap[0];
    expect(buy.status).toBe(TokenTradeOrderStatus.SETTLED);
    expect(buy.tokenStatus).toBe(TokenStatus.PRE_MINTED);
    const sellSnap = await database()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.SELL)
      .where('owner', '==', seller)
      .get();
    expect(sellSnap.length).toBe(1);
    const sell = <TokenTradeOrder>sellSnap[0];
    expect(sell.status).toBe(TokenTradeOrderStatus.SETTLED);
    expect(sell.tokenStatus).toBe(TokenStatus.PRE_MINTED);
    const sellDistribution = <TokenDistribution>(
      await database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, seller).get()
    );
    expect(sellDistribution.lockedForSale).toBe(0);
    expect(sellDistribution.sold).toBe(tokenCount);
    expect(sellDistribution.tokenOwned).toBe(2 * tokenCount);
    const buyDistribution = <TokenDistribution>(
      await database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, buyer).get()
    );
    expect(buyDistribution.totalPurchased).toBe(tokenCount);
    expect(buyDistribution.tokenOwned).toBe(tokenCount);
    const purchases = await database()
      .collection(COL.TOKEN_PURCHASE)
      .where('buy', '==', buy.uid)
      .get();
    expect(purchases.length).toBe(1);
    const purchase = <TokenPurchase>purchases[0];
    expect(purchase.buy).toBe(buy.uid);
    expect(purchase.sell).toBeDefined();
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT);
    expect(purchase.count).toBe(tokenCount);
    expect(purchase.tokenStatus).toBe(TokenStatus.PRE_MINTED);
    expect(purchase.sellerTier).toBe(0);
    expect(purchase.sellerTokenTradingFeePercentage).toBeUndefined();
    const sellerData = <Member>await database().doc(COL.MEMBER, seller).get();
    const billPaymentDocRef = database().doc(COL.TRANSACTION, purchase.billPaymentId!);
    const billPayment = <Transaction>await billPaymentDocRef.get();
    expect(billPayment.payload.sourceAddress).toBe(order.payload.targetAddress);
    expect(billPayment.payload.targetAddress).toBe(getAddress(sellerData, Network.IOTA));
    expect(billPayment.payload.token).toBe(token.uid);
    expect(billPayment.payload.tokenSymbol).toBe(token.symbol);
    expect(billPayment.payload.type).toBe(TransactionPayloadType.PRE_MINTED_TOKEN_TRADE);
    const paymentSnap = await getBillPayments(buyer);
    expect(paymentSnap.length).toBe(3);
    const payments = paymentSnap.sort((a, b) => a.payload.amount! - b.payload.amount!);
    expect(payments.map((d) => d.payload.amount)).toEqual(
      getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount),
    );
    expect(payments.map((d) => d.ignoreWallet)).toEqual([false, false, undefined]);
    payments.forEach((p) => {
      expect(p?.payload?.previousOwner).toBe(buyer);
      expect(p?.member).toBe(buyer);
    });
    await assertVolumeTotal(token.uid, tokenCount);
  });

  it('Should fulfill buy with one sell, same owner', async () => {
    buyer = seller;
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    const request = { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: tokenCount };
    const order = await buyTokenFunc(buyer, request);
    await wait(async () => {
      const buySnap = await database()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY)
        .where('owner', '==', buyer)
        .get();
      return buySnap[0].fulfilled === tokenCount;
    });
    const buySnap = await database()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.BUY)
      .where('owner', '==', buyer)
      .get();
    expect(buySnap.length).toBe(1);
    const buy = <TokenTradeOrder>buySnap[0];
    expect(buy.status).toBe(TokenTradeOrderStatus.SETTLED);
    const buyDistribution = <TokenDistribution>(
      await database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, buyer).get()
    );
    expect(buyDistribution.totalPurchased).toBe(tokenCount);
    expect(buyDistribution.tokenOwned).toBe(3 * tokenCount);
    const purchase = await database()
      .collection(COL.TOKEN_PURCHASE)
      .where('buy', '==', buy.uid)
      .get();
    expect(purchase.length).toBe(1);
    expect(purchase[0].buy).toBe(buy.uid);
    expect(purchase[0].sell).toBeDefined();
    expect(purchase[0].price).toBe(MIN_IOTA_AMOUNT);
    expect(purchase[0].count).toBe(tokenCount);
    const sellerData = <Member>await database().doc(COL.MEMBER, seller).get();
    const billPaymentDocRef = database().doc(COL.TRANSACTION, purchase[0].billPaymentId!);
    const billPayment = <Transaction>await billPaymentDocRef.get();
    expect(billPayment.payload.sourceAddress).toBe(order.payload.targetAddress);
    expect(billPayment.payload.targetAddress).toBe(getAddress(sellerData, Network.IOTA));
    expect(billPayment.payload.token).toBe(token.uid);
    expect(billPayment.payload.tokenSymbol).toBe(token.symbol);
    expect(billPayment.payload.type).toBe(TransactionPayloadType.PRE_MINTED_TOKEN_TRADE);
    const paymentSnap = await getBillPayments(buyer);
    expect(paymentSnap.length).toBe(3);
    const payments = paymentSnap.sort((a, b) => a.payload.amount! - b.payload.amount!);
    expect(payments.map((d) => d.payload.amount)).toEqual(
      getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount),
    );
    expect(payments.map((d) => d.ignoreWallet)).toEqual([false, false, undefined]);
    payments.forEach((p) => {
      expect(p?.payload?.previousOwner).toBe(seller);
      expect(p?.member).toBe(buyer);
    });
    await assertVolumeTotal(token.uid, tokenCount);
  });

  it('Should fulfill buy with two sell and credit owner', async () => {
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    const request = { symbol: token.symbol, price: MIN_IOTA_AMOUNT * 2, count: 2 * tokenCount };
    const order = await buyTokenFunc(buyer, request);
    await wait(async () => {
      const buySnap = await database()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY)
        .where('owner', '==', buyer)
        .get();
      return buySnap[0].fulfilled === 2 * tokenCount;
    });
    const buySnap = await database()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.BUY)
      .where('owner', '==', buyer)
      .get();
    expect(buySnap.length).toBe(1);
    const buy = <TokenTradeOrder>buySnap[0];
    expect(buy.status).toBe(TokenTradeOrderStatus.SETTLED);
    const credit = <Transaction>(
      await database().doc(COL.TRANSACTION, buy.creditTransactionId!).get()
    );
    expect(credit.payload.amount).toBe(MIN_IOTA_AMOUNT * 2 * tokenCount);
    expect(credit.payload.sourceTransaction).toContain(buySnap[0].paymentTransactionId);
    expect(credit?.payload?.sourceAddress).toBe(order.payload.targetAddress);
    const buyerData = <Member>await database().doc(COL.MEMBER, buyer).get();
    expect(credit?.payload?.targetAddress).toBe(getAddress(buyerData, Network.IOTA));
    expect(credit.network).toBe(DEFAULT_NETWORK);
    const paymentSnap = await getBillPayments(buyer);
    expect(paymentSnap.length).toBe(6);
    const amounts = paymentSnap.map((d) => d.payload.amount!).sort((a, b) => a - b);
    expect(amounts).toEqual(
      [
        ...getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount),
        ...getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount),
      ].sort((a, b) => a - b),
    );
    paymentSnap.forEach((doc) => expect(doc?.network).toBe(DEFAULT_NETWORK));
    await assertVolumeTotal(token.uid, 2 * tokenCount);
  });

  it('Should fulfill sell with two buy', async () => {
    const request = { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: tokenCount };
    await buyTokenFunc(buyer, request);
    await buyTokenFunc(buyer, request);
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 2 * tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await wait(async () => {
      const sellSnap = await database()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.SELL)
        .where('owner', '==', seller)
        .get();
      return sellSnap[0].fulfilled === 2 * tokenCount;
    });
    const sellSnap = await database()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.SELL)
      .where('owner', '==', seller)
      .get();
    expect(sellSnap.length).toBe(1);
    const sell = <TokenTradeOrder>sellSnap[0];
    expect(sell.status).toBe(TokenTradeOrderStatus.SETTLED);
    expect(sell.fulfilled).toBe(2 * tokenCount);
    await assertVolumeTotal(token.uid, 2 * tokenCount);
  });

  it('Should sell tokens in two transactions', async () => {
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 2 * tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 2 * tokenCount,
    });
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await buyTokenFunc(buyer, { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: tokenCount });
    await wait(async () => {
      const distribution = <TokenDistribution>(
        await database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, seller).get()
      );
      return distribution.tokenOwned === 0 && distribution.sold === 3 * tokenCount;
    });
  });

  it('Should buy in parallel', async () => {
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 2 * tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    const request = { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: tokenCount };
    const promises = [buyTokenFunc(buyer, request), buyTokenFunc(buyer, request)];
    await Promise.all(promises);
    await wait(async () => {
      const allSettled = (
        await database().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get()
      )
        .map((d) => <TokenTradeOrder>d)
        .reduce((sum, act) => sum && act.status === TokenTradeOrderStatus.SETTLED, true);
      return allSettled;
    });
    const sales = [
      ...(await database().collection(COL.TOKEN_MARKET).where('owner', '==', seller).get()),
      ...(await database().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get()),
    ].map((d) => <TokenTradeOrder>d);
    expect(sales.length).toBe(3);
    const buyFulfillmentCount = sales.reduce(
      (sum, sale) => sum + (sale.type === TokenTradeOrderType.BUY ? sale.fulfilled : 0),
      0,
    );
    expect(buyFulfillmentCount).toBe(2 * tokenCount);
    const sellFulfillmentCount = sales.reduce(
      (sum, sale) => sum + (sale.type === TokenTradeOrderType.SELL ? sale.fulfilled : 0),
      0,
    );
    expect(sellFulfillmentCount).toBe(2 * tokenCount);
    await assertVolumeTotal(token.uid, 2 * tokenCount);
  });

  it('Should buy and sell in parallel', async () => {
    const distributionDocRef = database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, seller);
    const distribution = { tokenOwned: 3 * tokenCount };
    await distributionDocRef.upsert(distribution);
    const sellTokenFunc = async (count: number, price: number) => {
      const sellDocId = wallet.getRandomEthAddress();
      const data = <TokenTradeOrder>{
        project: SOON_PROJECT_ID,
        uid: sellDocId,
        owner: seller,
        token: token.uid,
        type: TokenTradeOrderType.SELL,
        count: count,
        price: price,
        totalDeposit: count * price,
        balance: 0,
        expiresAt: serverTime(),
        fulfilled: 0,
        status: TokenTradeOrderStatus.ACTIVE,
        createdOn: serverTime(),
      };
      await database().doc(COL.TOKEN_MARKET, sellDocId).create(data);
      await distributionDocRef.update({ lockedForSale: database().inc(count) });
    };
    const buyRequest = { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: tokenCount };
    const promises = [
      buyTokenFunc(buyer, buyRequest),
      buyTokenFunc(buyer, buyRequest),
      sellTokenFunc(2 * tokenCount, MIN_IOTA_AMOUNT),
      buyTokenFunc(buyer, buyRequest),
      sellTokenFunc(tokenCount, MIN_IOTA_AMOUNT),
    ];
    await Promise.all(promises);
    await wait(async () => {
      const allSettled = [
        ...(await database().collection(COL.TOKEN_MARKET).where('owner', '==', seller).get()),
        ...(await database().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get()),
      ]
        .map((d) => <TokenTradeOrder>d)
        .reduce((sum, act) => sum && act.status === TokenTradeOrderStatus.SETTLED, true);
      return allSettled;
    });
    const sales = [
      ...(await database().collection(COL.TOKEN_MARKET).where('owner', '==', seller).get()),
      ...(await database().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get()),
    ].map((d) => <TokenTradeOrder>d);
    const allSettled = sales.reduce(
      (sum, act) => sum && act.status === TokenTradeOrderStatus.SETTLED,
      true,
    );
    expect(allSettled).toBe(true);
    const sellDistribution = <TokenDistribution>await distributionDocRef.get();
    expect(sellDistribution.sold).toBe(3 * tokenCount);
    expect(sellDistribution.lockedForSale).toBe(0);
    expect(sellDistribution.tokenOwned).toBe(0);
    const buyDistribution = <TokenDistribution>(
      await database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, buyer).get()
    );
    expect(buyDistribution.totalPurchased).toBe(3 * tokenCount);
    expect(buyDistribution.tokenOwned).toBe(3 * tokenCount);
    const paymentSnap = await getBillPayments(buyer);
    expect(paymentSnap.length).toBe(9);
    const amounts = paymentSnap.map((d) => d.payload.amount!).sort((a, b) => a - b);
    const sortedAmount = getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount);
    expect(amounts).toEqual(
      [...sortedAmount, ...sortedAmount, ...sortedAmount].sort((a, b) => a - b),
    );
    await assertVolumeTotal(token.uid, 3 * tokenCount);
  });

  it('Should cancel buy after half fulfilled', async () => {
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 2 * tokenCount,
    });
    await wait(async () => {
      const snap = await database()
        .collection(COL.TOKEN_MARKET)
        .where('owner', '==', buyer)
        .where('type', '==', TokenTradeOrderType.BUY)
        .get();
      return snap[0].fulfilled === tokenCount;
    });
    const snap = await database()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', buyer)
      .where('type', '==', TokenTradeOrderType.BUY)
      .get();
    mockWalletReturnValue(buyer, { uid: snap[0].uid });
    const cancelled = await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.cancelTradeOrder);
    expect(cancelled.status).toBe(TokenTradeOrderStatus.PARTIALLY_SETTLED_AND_CANCELLED);
    const creditSnap = await database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', buyer)
      .where('payload_type', '==', TransactionPayloadType.TOKEN_BUY)
      .get();
    expect(creditSnap.length).toBe(1);
    expect(creditSnap[0]?.payload?.amount).toBe(tokenCount * MIN_IOTA_AMOUNT);
    expect(creditSnap[0]?.payload?.reason).toBe(CreditPaymentReason.TRADE_CANCELLED);
    await assertVolumeTotal(token.uid, tokenCount);
  });

  it('Should cancel buy after half fulfilled, decimal values', async () => {
    const tokenCount = 7;
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT + 0.1,
      count: tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT + 0.1,
      count: 2 * tokenCount,
    });
    await wait(async () => {
      return (
        (await database().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get())[0]
          ?.fulfilled === tokenCount
      );
    });
    const buyQuery = database()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.BUY)
      .where('owner', '==', buyer);
    const buySnap = await buyQuery.get();
    expect(buySnap.length).toBe(1);
    const buy = <TokenTradeOrder>buySnap[0];
    mockWalletReturnValue(buyer, { uid: buy.uid });
    const cancelled = await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.cancelTradeOrder);
    expect(cancelled.status).toBe(TokenTradeOrderStatus.PARTIALLY_SETTLED_AND_CANCELLED);
    const creditSnap = await database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', buyer)
      .where('payload_type', '==', TransactionPayloadType.TOKEN_BUY)
      .get();
    expect(creditSnap.length).toBe(1);
    expect(creditSnap[0]?.payload?.amount).toBe(tokenCount * MIN_IOTA_AMOUNT + 1);
    expect(creditSnap[0]?.payload?.reason).toBe(CreditPaymentReason.TRADE_CANCELLED);
  });

  it('Should settle after second run on more than batch limit', async () => {
    const distribution = { tokenOwned: 70 * tokenCount };
    await database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, seller).upsert(distribution);
    const promises = Array.from(Array(TOKEN_TRADE_ORDER_FETCH_LIMIT + 50)).map(() =>
      saveSellToDb(1, MIN_IOTA_AMOUNT),
    );
    await Promise.all(promises);
    const count = TOKEN_TRADE_ORDER_FETCH_LIMIT + 20;
    const request = { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count };
    await buyTokenFunc(buyer, request);
    await wait(async () => {
      return (
        (
          await database()
            .collection(COL.TOKEN_MARKET)
            .where('type', '==', TokenTradeOrderType.BUY)
            .where('owner', '==', buyer)
            .get()
        )[0].status === TokenTradeOrderStatus.SETTLED
      );
    });
    const bu = await database()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.BUY)
      .where('owner', '==', buyer)
      .get();
    expect(bu.length).toBe(1);
    expect(bu[0]?.fulfilled).toBe(count);
    expect(bu[0]?.status).toBe(TokenTradeOrderStatus.SETTLED);
    const purchases = await database()
      .collection(COL.TOKEN_PURCHASE)
      .where('buy', '==', bu[0]?.uid)
      .get();
    expect(purchases.length).toBe(count);
  });

  it('Should settle after multiple runs, all too small, last one is ok', async () => {
    const promises = Array.from(Array(100)).map(() => saveSellToDb(1, 1));
    await Promise.all(promises);
    await saveSellToDb(1, MIN_IOTA_AMOUNT);
    const request = { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: 1 };
    await buyTokenFunc(buyer, request);
    await wait(async () => {
      return (
        (
          await database()
            .collection(COL.TOKEN_MARKET)
            .where('type', '==', TokenTradeOrderType.BUY)
            .where('owner', '==', buyer)
            .get()
        )[0].status === TokenTradeOrderStatus.SETTLED
      );
    });
    const bu = await database()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.BUY)
      .where('owner', '==', buyer)
      .get();
    expect(bu.length).toBe(1);
    expect(bu[0]?.fulfilled).toBe(1);
    expect(bu[0]?.status).toBe(TokenTradeOrderStatus.SETTLED);
    const purchases = await database()
      .collection(COL.TOKEN_PURCHASE)
      .where('buy', '==', bu[0]?.uid)
      .get();
    expect(purchases.length).toBe(1);
  });

  it('Should not fill buy, balance would be less then MIN_IOTA_AMOUNT and order not fulfilled', async () => {
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2,
      count: 2 * tokenCount - 1,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2,
      count: 2 * tokenCount,
    });
    const orderQuery = database().collection(COL.TOKEN_MARKET).where('token', '==', token.uid);
    await wait(async () => {
      const snap = await orderQuery.get();
      return snap.length === 2;
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const purchase = await database()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', token.uid)
      .get();
    expect(purchase.length).toBe(0);
  });

  it('Should fill buy and send dust to space one', async () => {
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2,
      count: 2 * tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2 + 1,
      count: 2 * tokenCount,
    });
    const purchaseQuery = database().collection(COL.TOKEN_PURCHASE).where('token', '==', token.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.length === 1;
    });
    const purchase = <TokenPurchase>(await purchaseQuery.get())[0];
    expect(purchase.count).toBe(2 * tokenCount);
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT / 2);
    const billPayments = (
      await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload_token', '==', token.uid)
        .get()
    ).map((d) => <Transaction>d);
    const billPaymentToSeller = billPayments.find(
      (bp) => bp.payload.amount === (MIN_IOTA_AMOUNT / 2) * (2 * tokenCount) * 0.975,
    );
    expect(billPaymentToSeller).toBeDefined();
    const billPaymentToSpaceOne = billPayments.find(
      (bp) => bp.payload.amount === (MIN_IOTA_AMOUNT / 2) * (2 * tokenCount) * 0.025 * 0.1 + 800,
    );
    expect(billPaymentToSpaceOne).toBeDefined();
    const billPaymentToSpaceTwo = billPayments.find(
      (bp) => bp.payload.amount === (MIN_IOTA_AMOUNT / 2) * (2 * tokenCount) * 0.025 * 0.9,
    );
    expect(billPaymentToSpaceTwo).toBeDefined();
  });

  it.each([false, true])(
    'Should not create royalty payments as percentage is zero',
    async (isMember: boolean) => {
      if (isMember) {
        await database().doc(COL.MEMBER, seller).update({ tokenTradingFeePercentage: 0 });
        await database()
          .doc(COL.TOKEN, soonTokenId, SUB_COL.DISTRIBUTION, seller)
          .upsert({ stakes_dynamic_value: 15000 * MIN_IOTA_AMOUNT });
      } else {
        await database()
          .doc(COL.SYSTEM, SYSTEM_CONFIG_DOC_ID)
          .upsert({ tokenTradingFeePercentage: 0 });
      }
      mockWalletReturnValue(seller, {
        symbol: token.symbol,
        price: MIN_IOTA_AMOUNT / 2,
        count: 2 * tokenCount,
        type: TokenTradeOrderType.SELL,
      });
      await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
      await buyTokenFunc(buyer, {
        symbol: token.symbol,
        price: MIN_IOTA_AMOUNT / 2,
        count: 2 * tokenCount,
      });
      const purchaseQuery = database()
        .collection(COL.TOKEN_PURCHASE)
        .where('token', '==', token.uid);
      await wait(async () => {
        const snap = await purchaseQuery.get();
        return snap.length === 1;
      });
      const purchase = <TokenPurchase>(await purchaseQuery.get())[0];
      expect(purchase.count).toBe(2 * tokenCount);
      expect(purchase.price).toBe(MIN_IOTA_AMOUNT / 2);
      if (isMember) {
        expect(purchase.sellerTier).toBe(4);
        expect(purchase.sellerTokenTradingFeePercentage).toBe(0);
      }
      const billPayments = (
        await database()
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.BILL_PAYMENT)
          .where('payload_token', '==', token.uid)
          .get()
      ).map((d) => <Transaction>d);
      expect(billPayments.length).toBe(1);
      const billPaymentToSeller = billPayments.find(
        (bp) => bp.payload.amount === (MIN_IOTA_AMOUNT / 2) * (2 * tokenCount),
      );
      expect(billPaymentToSeller).toBeDefined();
    },
  );

  it('Should create royalty payments only with dust', async () => {
    await database().doc(COL.MEMBER, seller).update({ tokenTradingFeePercentage: 0 });
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2,
      count: 2 * tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2 + 1,
      count: 2 * tokenCount,
    });
    const purchaseQuery = database().collection(COL.TOKEN_PURCHASE).where('token', '==', token.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.length === 1;
    });
    const purchase = <TokenPurchase>(await purchaseQuery.get())[0];
    expect(purchase.count).toBe(2 * tokenCount);
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT / 2);
    const billPayments = (
      await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload_token', '==', token.uid)
        .get()
    ).map((d) => <Transaction>d);
    expect(billPayments.length).toBe(2);
    const billPaymentToSeller = billPayments.find(
      (bp) => bp.payload.amount === (MIN_IOTA_AMOUNT / 2) * (2 * tokenCount) + 800,
    );
    expect(billPaymentToSeller).toBeDefined();
    const billPaymentToSpaceOne = billPayments.find((bp) => bp.payload.amount === 800);
    expect(billPaymentToSpaceOne).toBeDefined();
  });

  it('Should fill buy and send dust to space one', async () => {
    await database().doc(COL.MEMBER, seller).update({ tokenTradingFeePercentage: 1 });
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2,
      count: 2 * tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2,
      count: 2 * tokenCount,
    });
    const purchaseQuery = database().collection(COL.TOKEN_PURCHASE).where('token', '==', token.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.length === 1;
    });
    const purchase = <TokenPurchase>(await purchaseQuery.get())[0];
    expect(purchase.count).toBe(2 * tokenCount);
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT / 2);
    const billPayments = (
      await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload_token', '==', token.uid)
        .get()
    ).map((d) => <Transaction>d);
    const billPaymentToSpaceOne = billPayments.find(
      (bp) => bp.payload.amount === (MIN_IOTA_AMOUNT / 2) * (2 * tokenCount) * 0.01 * 0.1,
    );
    expect(billPaymentToSpaceOne).toBeDefined();
    const billPaymentToSpaceTwo = billPayments.find(
      (bp) => bp.payload.amount === (MIN_IOTA_AMOUNT / 2) * (2 * tokenCount) * 0.01 * 0.9,
    );
    expect(billPaymentToSpaceTwo).toBeDefined();
    const billPaymentToSeller = billPayments.find(
      (bp) =>
        bp.payload.amount ===
        (MIN_IOTA_AMOUNT / 2) * (2 * tokenCount) * 0.99 +
          (billPaymentToSpaceOne?.payload?.amount! < MIN_IOTA_AMOUNT
            ? billPaymentToSpaceOne?.payload?.amount!
            : 0) +
          (billPaymentToSpaceTwo?.payload?.amount! < MIN_IOTA_AMOUNT
            ? billPaymentToSpaceTwo?.payload?.amount!
            : 0),
    );
    expect(billPaymentToSeller).toBeDefined();
  });

  it('Should fulfill buy but only create one space bill payment', async () => {
    const tokenCount = 100;
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    const request = { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: tokenCount };
    await buyTokenFunc(buyer, request);
    await wait(async () => {
      return (
        (
          await database()
            .collection(COL.TOKEN_MARKET)
            .where('type', '==', TokenTradeOrderType.BUY)
            .where('owner', '==', buyer)
            .get()
        )[0].status === TokenTradeOrderStatus.SETTLED
      );
    });
    const paymentSnap = await getBillPayments(buyer);
    expect(paymentSnap.length).toBe(3);
    const sortedPayments = paymentSnap.sort((a, b) => a.payload.amount! - b.payload.amount!);
    expect(sortedPayments.map((d) => d.payload.amount)).toEqual(
      getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount),
    );
    expect(sortedPayments.map((d) => d.ignoreWallet)).toEqual([true, false, undefined]);
  });

  it('Should cancel sell after half fulfilled', async () => {
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 10,
      type: TokenTradeOrderType.SELL,
    });
    const sell = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await buyTokenFunc(buyer, { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: 5 });
    await wait(async () => {
      return (
        (await database().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get())[0]
          ?.fulfilled === 5
      );
    });
    mockWalletReturnValue(seller, { uid: sell.uid });
    const cancelled = await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.cancelTradeOrder);
    expect(cancelled.status).toBe(TokenTradeOrderStatus.PARTIALLY_SETTLED_AND_CANCELLED);
    const sellDistribution = <TokenDistribution>(
      await database().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, seller).get()
    );
    expect(sellDistribution.lockedForSale).toBe(0);
    expect(sellDistribution.sold).toBe(5);
    expect(sellDistribution.tokenOwned).toBe(tokenCount * 3 - 5);
  });

  it('Should fulfill buy with lowest sell', async () => {
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: 2 * MIN_IOTA_AMOUNT,
      count: 10,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);

    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 10,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await buyTokenFunc(buyer, { symbol: token.symbol, price: 2 * MIN_IOTA_AMOUNT, count: 10 });
    await wait(async () => {
      return (
        (await database().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get())[0]
          ?.fulfilled === 10
      );
    });
    const buys = await database().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get();
    const purchase = <TokenPurchase>(
      (await database().collection(COL.TOKEN_PURCHASE).where('buy', '==', buys[0].uid).get())[0]
    );
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT);
  });

  it('Should fulfill sell with highest buy', async () => {
    await buyTokenFunc(buyer, { symbol: token.symbol, price: 2 * MIN_IOTA_AMOUNT, count: 10 });
    await buyTokenFunc(buyer, { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: 10 });
    await wait(async () => {
      const snap = await database().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get();
      const wasUpdated = snap.reduce((acc, act) => acc && !isEmpty(act.updatedOn), true);
      return snap.length === 2 && wasUpdated;
    });

    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 10,
      type: TokenTradeOrderType.SELL,
    });
    const sell = await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.tradeToken);

    await wait(async () => {
      return (
        (await database().collection(COL.TOKEN_MARKET).where('owner', '==', seller).get())[0]
          ?.fulfilled === 10
      );
    });

    const purchase = <TokenPurchase>(
      (await database().collection(COL.TOKEN_PURCHASE).where('sell', '==', sell.uid).get())[0]
    );
    expect(purchase.price).toBe(2 * MIN_IOTA_AMOUNT);
  });

  it('Should fulfill low price sell with high price buy', async () => {
    mockWalletReturnValue(seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2,
      count: 100,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    const order = await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 99,
    });

    const buyQuery = database()
      .collection(COL.TOKEN_MARKET)
      .where('orderTransactionId', '==', order.uid);
    await wait(async () => {
      const buySnap = await buyQuery.get();
      return buySnap[0].fulfilled === 99;
    });

    const order2 = await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: 2 * MIN_IOTA_AMOUNT,
      count: 1,
    });

    const buyQuery2 = database()
      .collection(COL.TOKEN_MARKET)
      .where('orderTransactionId', '==', order2.uid);
    await wait(async () => {
      const buySnap = await buyQuery2.get();
      return buySnap[0].fulfilled === 1;
    });

    const buy = (await buyQuery2.get())[0] as TokenTradeOrder;
    const purchase = (
      await database().collection(COL.TOKEN_PURCHASE).where('buy', '==', buy.uid).get()
    )[0] as TokenPurchase;

    expect(purchase.price).toBe(2 * MIN_IOTA_AMOUNT);
  });
});
