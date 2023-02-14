import {
  BillPaymentType,
  COL,
  CreditPaymentReason,
  DEFAULT_NETWORK,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  StakeType,
  SUB_COL,
  SYSTEM_CONFIG_DOC_ID,
  Token,
  TokenDistribution,
  TokenPurchase,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  TOKEN_SALE_TEST,
  Transaction,
  TransactionCreditType,
  TransactionType,
  URL_PATHS,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import bigDecimal from 'js-big-decimal';
import { isEmpty } from 'lodash';
import admin from '../../src/admin.config';
import { cancelTradeOrder } from '../../src/controls/token-trading/token-trade-cancel.controller';
import { tradeToken } from '../../src/controls/token-trading/token-trade.controller';
import { TOKEN_TRADE_ORDER_FETCH_LIMIT } from '../../src/triggers/token-trading/match-token';
import { getAddress } from '../../src/utils/address.utils';
import { cOn, dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import {
  createMember,
  createRoyaltySpaces,
  getRandomSymbol,
  milestoneProcessed,
  mockWalletReturnValue,
  saveSoon,
  submitMilestoneFunc,
  wait,
} from './common';

let walletSpy: any;

const buyTokenFunc = async (memberAddress: string, request: any) => {
  mockWalletReturnValue(walletSpy, memberAddress, { ...request, type: TokenTradeOrderType.BUY });
  const order = await testEnv.wrap(tradeToken)({});
  const milestone = await submitMilestoneFunc(
    order.payload.targetAddress,
    Number(bigDecimal.floor(bigDecimal.multiply(request.price, request.count))),
  );
  await milestoneProcessed(milestone.milestone, milestone.tranId);
  return order;
};

const assertVolumeTotal = async (tokenId: string, volumeTotal: number) => {
  const statDoc = admin.firestore().doc(`${COL.TOKEN}/${tokenId}/${SUB_COL.STATS}/${tokenId}`);
  await wait(async () => (await statDoc.get()).data()?.volumeTotal === volumeTotal);
};

const getBillPayments = (member: string) =>
  admin
    .firestore()
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
  let soonTokenId: string;

  let token: Token;
  const tokenCount = 400;

  const saveSellToDb = async (count: number, price: number) => {
    const data = cOn(
      <TokenTradeOrder>{
        uid: wallet.getRandomEthAddress(),
        owner: seller,
        token: token.uid,
        type: TokenTradeOrderType.SELL,
        count: count,
        price: price,
        totalDeposit: count * price,
        balance: 0,
        expiresAt: dateToTimestamp(dayjs()),
        fulfilled: 0,
        status: TokenTradeOrderStatus.ACTIVE,
      },
      URL_PATHS.TOKEN_MARKET,
    );
    await admin.firestore().doc(`${COL.TOKEN_MARKET}/${data.uid}`).create(data);
  };

  beforeAll(async () => {
    await createRoyaltySpaces();
    soonTokenId = await saveSoon();
  });

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    seller = await createMember(walletSpy);
    buyer = await createMember(walletSpy);

    const tokenId = wallet.getRandomEthAddress();
    token = <Token>{
      uid: tokenId,
      symbol: getRandomSymbol(),
      name: 'MyToken',
      space: 'myspace',
      status: TokenStatus.PRE_MINTED,
      approved: true,
    };
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).set(token);
    const distribution = <TokenDistribution>{ tokenOwned: tokenCount * 3 };
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${tokenId}/${SUB_COL.DISTRIBUTION}/${seller}`)
      .set(distribution);

    await admin
      .firestore()
      .doc(`${COL.SYSTEM}/${SYSTEM_CONFIG_DOC_ID}`)
      .set({ tokenTradingFeePercentage: admin.firestore.FieldValue.delete() }, { merge: true });
  });

  it('Should fulfill buy with one sell', async () => {
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});

    const request = { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: tokenCount };
    const order = await buyTokenFunc(buyer, request);

    await wait(async () => {
      const buySnap = await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY)
        .where('owner', '==', buyer)
        .get();
      return buySnap.docs[0].data().fulfilled === tokenCount;
    });

    const buySnap = await admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.BUY)
      .where('owner', '==', buyer)
      .get();
    expect(buySnap.docs.length).toBe(1);
    const buy = <TokenTradeOrder>buySnap.docs[0].data();
    expect(buy.status).toBe(TokenTradeOrderStatus.SETTLED);
    expect(buy.tokenStatus).toBe(TokenStatus.PRE_MINTED);

    const sellSnap = await admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.SELL)
      .where('owner', '==', seller)
      .get();
    expect(sellSnap.docs.length).toBe(1);
    const sell = <TokenTradeOrder>sellSnap.docs[0].data();
    expect(sell.status).toBe(TokenTradeOrderStatus.SETTLED);
    expect(sell.tokenStatus).toBe(TokenStatus.PRE_MINTED);

    const sellDistribution = <TokenDistribution>(
      (
        await admin
          .firestore()
          .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${seller}`)
          .get()
      ).data()
    );
    expect(sellDistribution.lockedForSale).toBe(0);
    expect(sellDistribution.sold).toBe(tokenCount);
    expect(sellDistribution.tokenOwned).toBe(2 * tokenCount);
    const buyDistribution = <TokenDistribution>(
      (
        await admin
          .firestore()
          .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${buyer}`)
          .get()
      ).data()
    );
    expect(buyDistribution.totalPurchased).toBe(tokenCount);
    expect(buyDistribution.tokenOwned).toBe(tokenCount);

    const purchases = (
      await admin.firestore().collection(COL.TOKEN_PURCHASE).where('buy', '==', buy.uid).get()
    ).docs;
    expect(purchases.length).toBe(1);
    const purchase = <TokenPurchase>purchases[0].data();
    expect(purchase.buy).toBe(buy.uid);
    expect(purchase.sell).toBeDefined();
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT);
    expect(purchase.count).toBe(tokenCount);
    expect(purchase.tokenStatus).toBe(TokenStatus.PRE_MINTED);
    expect(purchase.sellerTier).toBe(0);
    expect(purchase.sellerTokenTradingFeePercentage).toBeNull();

    const sellerData = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${seller}`).get()).data()
    );
    const billPaymentDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${purchase.billPaymentId}`);
    const billPayment = <Transaction>(await billPaymentDocRef.get()).data();
    expect(billPayment.payload.sourceAddress).toBe(order.payload.targetAddress);
    expect(billPayment.payload.targetAddress).toBe(getAddress(sellerData, Network.IOTA));
    expect(billPayment.payload.token).toBe(token.uid);
    expect(billPayment.payload.tokenSymbol).toBe(token.symbol);
    expect(billPayment.payload.type).toBe(BillPaymentType.PRE_MINTED_TOKEN_TRADE);

    const paymentSnap = await getBillPayments(buyer);
    expect(paymentSnap.docs.length).toBe(3);
    const payments = paymentSnap.docs.sort(
      (a, b) => a.data().payload.amount - b.data().payload.amount,
    );
    expect(payments.map((d) => d.data().payload.amount)).toEqual(
      getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount),
    );
    expect(payments.map((d) => d.data().ignoreWallet)).toEqual([false, false, undefined]);

    payments.forEach((p) => {
      expect(p.data()?.payload?.previousOwner).toBe(buyer);
      expect(p.data()?.member).toBe(buyer);
    });

    await assertVolumeTotal(token.uid, tokenCount);
  });

  it('Should fulfill buy with one sell, same owner', async () => {
    buyer = seller;

    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});

    const request = { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: tokenCount };
    const order = await buyTokenFunc(buyer, request);

    await wait(async () => {
      const buySnap = await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY)
        .where('owner', '==', buyer)
        .get();
      return buySnap.docs[0].data().fulfilled === tokenCount;
    });

    const buySnap = await admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.BUY)
      .where('owner', '==', buyer)
      .get();
    expect(buySnap.docs.length).toBe(1);
    const buy = <TokenTradeOrder>buySnap.docs[0].data();
    expect(buy.status).toBe(TokenTradeOrderStatus.SETTLED);
    const buyDistribution = <TokenDistribution>(
      (
        await admin
          .firestore()
          .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${buyer}`)
          .get()
      ).data()
    );
    expect(buyDistribution.totalPurchased).toBe(tokenCount);
    expect(buyDistribution.tokenOwned).toBe(3 * tokenCount);

    const purchase = (
      await admin.firestore().collection(COL.TOKEN_PURCHASE).where('buy', '==', buy.uid).get()
    ).docs;
    expect(purchase.length).toBe(1);
    expect(purchase[0].data().buy).toBe(buy.uid);
    expect(purchase[0].data().sell).toBeDefined();
    expect(purchase[0].data().price).toBe(MIN_IOTA_AMOUNT);
    expect(purchase[0].data().count).toBe(tokenCount);

    const sellerData = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${seller}`).get()).data()
    );
    const billPaymentDocRef = admin
      .firestore()
      .doc(`${COL.TRANSACTION}/${purchase[0].data().billPaymentId}`);
    const billPayment = <Transaction>(await billPaymentDocRef.get()).data();
    expect(billPayment.payload.sourceAddress).toBe(order.payload.targetAddress);
    expect(billPayment.payload.targetAddress).toBe(getAddress(sellerData, Network.IOTA));
    expect(billPayment.payload.token).toBe(token.uid);
    expect(billPayment.payload.tokenSymbol).toBe(token.symbol);
    expect(billPayment.payload.type).toBe(BillPaymentType.PRE_MINTED_TOKEN_TRADE);

    const paymentSnap = await getBillPayments(buyer);
    expect(paymentSnap.docs.length).toBe(3);
    const payments = paymentSnap.docs.sort(
      (a, b) => a.data().payload.amount - b.data().payload.amount,
    );
    expect(payments.map((d) => d.data().payload.amount)).toEqual(
      getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount),
    );
    expect(payments.map((d) => d.data().ignoreWallet)).toEqual([false, false, undefined]);

    payments.forEach((p) => {
      expect(p.data()?.payload?.previousOwner).toBe(seller);
      expect(p.data()?.member).toBe(buyer);
    });

    await assertVolumeTotal(token.uid, tokenCount);
  });

  it('Should fulfill buy with two sell and credit owner', async () => {
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});

    const request = { symbol: token.symbol, price: MIN_IOTA_AMOUNT * 2, count: 2 * tokenCount };
    const order = await buyTokenFunc(buyer, request);

    await wait(async () => {
      const buySnap = await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY)
        .where('owner', '==', buyer)
        .get();
      return buySnap.docs[0].data().fulfilled === 2 * tokenCount;
    });

    const buySnap = await admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.BUY)
      .where('owner', '==', buyer)
      .get();
    expect(buySnap.docs.length).toBe(1);
    const buy = <TokenTradeOrder>buySnap.docs[0].data();
    expect(buy.status).toBe(TokenTradeOrderStatus.SETTLED);

    const credit = <Transaction>(
      (await admin.firestore().doc(`${COL.TRANSACTION}/${buy.creditTransactionId}`).get()).data()
    );
    expect(credit.payload.amount).toBe(MIN_IOTA_AMOUNT * 2 * tokenCount);
    expect(credit.payload.sourceTransaction).toContain(buySnap.docs[0].data().paymentTransactionId);
    expect(credit?.payload?.sourceAddress).toBe(order.payload.targetAddress);
    const buyerData = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buyer}`).get()).data();
    expect(credit?.payload?.targetAddress).toBe(getAddress(buyerData, Network.IOTA));
    expect(credit.network).toBe(DEFAULT_NETWORK);

    const paymentSnap = await getBillPayments(buyer);
    expect(paymentSnap.docs.length).toBe(6);
    const amounts = paymentSnap.docs.map((d) => d.data().payload.amount).sort((a, b) => a - b);
    expect(amounts).toEqual(
      [
        ...getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount),
        ...getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount),
      ].sort((a, b) => a - b),
    );
    paymentSnap.docs.forEach((doc) => expect(doc.data()?.network).toBe(DEFAULT_NETWORK));

    await assertVolumeTotal(token.uid, 2 * tokenCount);
  });

  it('Should fulfill sell with two buy', async () => {
    const request = { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: tokenCount };
    await buyTokenFunc(buyer, request);
    await buyTokenFunc(buyer, request);

    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 2 * tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});

    await wait(async () => {
      const sellSnap = await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.SELL)
        .where('owner', '==', seller)
        .get();
      return sellSnap.docs[0].data().fulfilled === 2 * tokenCount;
    });

    const sellSnap = await admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.SELL)
      .where('owner', '==', seller)
      .get();
    expect(sellSnap.docs.length).toBe(1);
    const sell = <TokenTradeOrder>sellSnap.docs[0].data();
    expect(sell.status).toBe(TokenTradeOrderStatus.SETTLED);
    expect(sell.fulfilled).toBe(2 * tokenCount);

    await assertVolumeTotal(token.uid, 2 * tokenCount);
  });

  it('Should sell tokens in two transactions', async () => {
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 2 * tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});
    await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 2 * tokenCount,
    });

    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});
    await buyTokenFunc(buyer, { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: tokenCount });

    await wait(async () => {
      const distribution = <TokenDistribution>(
        (
          await admin
            .firestore()
            .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${seller}`)
            .get()
        ).data()
      );
      return distribution.tokenOwned === 0 && distribution.sold === 3 * tokenCount;
    });
  });

  it('Should buy in parallel', async () => {
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 2 * tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});
    const request = { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: tokenCount };
    const promises = [buyTokenFunc(buyer, request), buyTokenFunc(buyer, request)];
    await Promise.all(promises);

    await wait(async () => {
      const allSettled = (
        await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get()
      ).docs
        .map((d) => <TokenTradeOrder>d.data())
        .reduce((sum, act) => sum && act.status === TokenTradeOrderStatus.SETTLED, true);
      return allSettled;
    });

    const sales = (
      await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('owner', 'in', [seller, buyer])
        .get()
    ).docs.map((d) => <TokenTradeOrder>d.data());
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
    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${seller}`);
    const distribution = <TokenDistribution>{ tokenOwned: 3 * tokenCount };
    await distributionDocRef.set(distribution);
    const sellTokenFunc = async (count: number, price: number) => {
      const sellDocId = wallet.getRandomEthAddress();
      const data = cOn(
        <TokenTradeOrder>{
          uid: sellDocId,
          owner: seller,
          token: token.uid,
          type: TokenTradeOrderType.SELL,
          count: count,
          price: price,
          totalDeposit: count * price,
          balance: 0,
          expiresAt: dateToTimestamp(dayjs()),
          fulfilled: 0,
          status: TokenTradeOrderStatus.ACTIVE,
        },
        URL_PATHS.TOKEN_MARKET,
      );
      await admin.firestore().doc(`${COL.TOKEN_MARKET}/${sellDocId}`).create(data);
      await distributionDocRef.update({
        lockedForSale: admin.firestore.FieldValue.increment(count),
      });
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
      const allSettled = (
        await admin
          .firestore()
          .collection(COL.TOKEN_MARKET)
          .where('owner', 'in', [seller, buyer])
          .get()
      ).docs
        .map((d) => <TokenTradeOrder>d.data())
        .reduce((sum, act) => sum && act.status === TokenTradeOrderStatus.SETTLED, true);
      return allSettled;
    });

    const sales = (
      await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('owner', 'in', [seller, buyer])
        .get()
    ).docs.map((d) => <TokenTradeOrder>d.data());

    const allSettled = sales.reduce(
      (sum, act) => sum && act.status === TokenTradeOrderStatus.SETTLED,
      true,
    );
    expect(allSettled).toBe(true);

    const sellDistribution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(sellDistribution.sold).toBe(3 * tokenCount);
    expect(sellDistribution.lockedForSale).toBe(0);
    expect(sellDistribution.tokenOwned).toBe(0);
    const buyDistribution = <TokenDistribution>(
      (
        await admin
          .firestore()
          .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${buyer}`)
          .get()
      ).data()
    );
    expect(buyDistribution.totalPurchased).toBe(3 * tokenCount);
    expect(buyDistribution.tokenOwned).toBe(3 * tokenCount);

    const paymentSnap = await getBillPayments(buyer);
    expect(paymentSnap.docs.length).toBe(9);
    const amounts = paymentSnap.docs.map((d) => d.data().payload.amount).sort((a, b) => a - b);
    const sortedAmount = getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount);
    expect(amounts).toEqual(
      [...sortedAmount, ...sortedAmount, ...sortedAmount].sort((a, b) => a - b),
    );

    await assertVolumeTotal(token.uid, 3 * tokenCount);
  });

  it('Should cancel buy after half fulfilled', async () => {
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});
    await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 2 * tokenCount,
    });

    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('owner', '==', buyer)
        .where('type', '==', TokenTradeOrderType.BUY)
        .get();
      return snap.docs[0].data().fulfilled === tokenCount;
    });

    const snap = await admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', buyer)
      .where('type', '==', TokenTradeOrderType.BUY)
      .get();
    mockWalletReturnValue(walletSpy, buyer, { uid: snap.docs[0].id });
    const cancelled = await testEnv.wrap(cancelTradeOrder)({});
    expect(cancelled.status).toBe(TokenTradeOrderStatus.PARTIALLY_SETTLED_AND_CANCELLED);

    const creditSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', buyer)
      .where('payload.type', '==', TransactionCreditType.TOKEN_BUY)
      .get();
    expect(creditSnap.docs.length).toBe(1);
    expect(creditSnap.docs[0].data()?.payload?.amount).toBe(tokenCount * MIN_IOTA_AMOUNT);
    expect(creditSnap.docs[0].data()?.payload?.reason).toBe(CreditPaymentReason.TRADE_CANCELLED);

    await assertVolumeTotal(token.uid, tokenCount);
  });

  it('Should cancel buy after half fulfilled, decimal values', async () => {
    const tokenCount = 7;
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT + 0.1,
      count: tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});
    await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT + 0.1,
      count: 2 * tokenCount,
    });

    await wait(async () => {
      return (
        (
          await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get()
        ).docs[0]?.data()?.fulfilled === tokenCount
      );
    });

    const buyQuery = admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.BUY)
      .where('owner', '==', buyer);
    const buySnap = await buyQuery.get();
    expect(buySnap.docs.length).toBe(1);
    const buy = <TokenTradeOrder>buySnap.docs[0].data();

    mockWalletReturnValue(walletSpy, buyer, { uid: buy.uid });
    const cancelled = await testEnv.wrap(cancelTradeOrder)({});
    expect(cancelled.status).toBe(TokenTradeOrderStatus.PARTIALLY_SETTLED_AND_CANCELLED);

    const creditSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', buyer)
      .where('payload.type', '==', TransactionCreditType.TOKEN_BUY)
      .get();
    expect(creditSnap.docs.length).toBe(1);
    expect(creditSnap.docs[0].data()?.payload?.amount).toBe(tokenCount * MIN_IOTA_AMOUNT + 1);
    expect(creditSnap.docs[0].data()?.payload?.reason).toBe(CreditPaymentReason.TRADE_CANCELLED);
  });

  it('Should settle after second run on more than batch limit', async () => {
    const distribution = <TokenDistribution>{ tokenOwned: 70 * tokenCount };
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${seller}`)
      .set(distribution);

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
          await admin
            .firestore()
            .collection(COL.TOKEN_MARKET)
            .where('type', '==', TokenTradeOrderType.BUY)
            .where('owner', '==', buyer)
            .get()
        ).docs[0].data().status === TokenTradeOrderStatus.SETTLED
      );
    });
    const buyDocs = (
      await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY)
        .where('owner', '==', buyer)
        .get()
    ).docs;
    expect(buyDocs.length).toBe(1);
    expect(buyDocs[0].data()?.fulfilled).toBe(count);
    expect(buyDocs[0].data()?.status).toBe(TokenTradeOrderStatus.SETTLED);

    const purchases = (
      await admin
        .firestore()
        .collection(COL.TOKEN_PURCHASE)
        .where('buy', '==', buyDocs[0].data()?.uid)
        .get()
    ).docs;
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
          await admin
            .firestore()
            .collection(COL.TOKEN_MARKET)
            .where('type', '==', TokenTradeOrderType.BUY)
            .where('owner', '==', buyer)
            .get()
        ).docs[0].data().status === TokenTradeOrderStatus.SETTLED
      );
    });
    const buyDocs = (
      await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY)
        .where('owner', '==', buyer)
        .get()
    ).docs;
    expect(buyDocs.length).toBe(1);
    expect(buyDocs[0].data()?.fulfilled).toBe(1);
    expect(buyDocs[0].data()?.status).toBe(TokenTradeOrderStatus.SETTLED);

    const purchases = (
      await admin
        .firestore()
        .collection(COL.TOKEN_PURCHASE)
        .where('buy', '==', buyDocs[0].data()?.uid)
        .get()
    ).docs;
    expect(purchases.length).toBe(1);
  });

  it('Should not fill buy, balance would be less then MIN_IOTA_AMOUNT and order not fulfilled', async () => {
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2,
      count: 2 * tokenCount - 1,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});

    await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2,
      count: 2 * tokenCount,
    });

    const orderQuery = admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('token', '==', token.uid);
    await wait(async () => {
      const snap = await orderQuery.get();
      return snap.size === 2;
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const purchase = await admin
      .firestore()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', token.uid)
      .get();
    expect(purchase.size).toBe(0);
  });

  it('Should fill buy and send dust to space one', async () => {
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2,
      count: 2 * tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});

    await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2 + 1,
      count: 2 * tokenCount,
    });

    const purchaseQuery = admin
      .firestore()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', token.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.docs.length === 1;
    });

    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data();
    expect(purchase.count).toBe(2 * tokenCount);
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT / 2);

    const billPayments = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload.token', '==', token.uid)
        .get()
    ).docs.map((d) => <Transaction>d.data());

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
        await admin
          .firestore()
          .doc(`${COL.MEMBER}/${seller}`)
          .update({ tokenTradingFeePercentage: 0 });
        await admin
          .firestore()
          .collection(COL.TOKEN)
          .doc(soonTokenId)
          .collection(SUB_COL.DISTRIBUTION)
          .doc(seller)
          .set(
            {
              stakes: {
                [StakeType.DYNAMIC]: {
                  value: 15000 * MIN_IOTA_AMOUNT,
                },
              },
            },
            { merge: true },
          );
      } else {
        await admin
          .firestore()
          .doc(`${COL.SYSTEM}/${SYSTEM_CONFIG_DOC_ID}`)
          .set({ tokenTradingFeePercentage: 0 });
      }
      mockWalletReturnValue(walletSpy, seller, {
        symbol: token.symbol,
        price: MIN_IOTA_AMOUNT / 2,
        count: 2 * tokenCount,
        type: TokenTradeOrderType.SELL,
      });
      await testEnv.wrap(tradeToken)({});

      await buyTokenFunc(buyer, {
        symbol: token.symbol,
        price: MIN_IOTA_AMOUNT / 2,
        count: 2 * tokenCount,
      });

      const purchaseQuery = admin
        .firestore()
        .collection(COL.TOKEN_PURCHASE)
        .where('token', '==', token.uid);
      await wait(async () => {
        const snap = await purchaseQuery.get();
        return snap.docs.length === 1;
      });

      const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data();
      expect(purchase.count).toBe(2 * tokenCount);
      expect(purchase.price).toBe(MIN_IOTA_AMOUNT / 2);
      if (isMember) {
        expect(purchase.sellerTier).toBe(4);
        expect(purchase.sellerTokenTradingFeePercentage).toBe(0);
      }

      const billPayments = (
        await admin
          .firestore()
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.BILL_PAYMENT)
          .where('payload.token', '==', token.uid)
          .get()
      ).docs.map((d) => <Transaction>d.data());
      expect(billPayments.length).toBe(1);

      const billPaymentToSeller = billPayments.find(
        (bp) => bp.payload.amount === (MIN_IOTA_AMOUNT / 2) * (2 * tokenCount),
      );
      expect(billPaymentToSeller).toBeDefined();
    },
  );

  it('Should create royalty payments only with dust', async () => {
    await admin.firestore().doc(`${COL.MEMBER}/${seller}`).update({ tokenTradingFeePercentage: 0 });
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2,
      count: 2 * tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});

    await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2 + 1,
      count: 2 * tokenCount,
    });

    const purchaseQuery = admin
      .firestore()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', token.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.docs.length === 1;
    });

    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data();
    expect(purchase.count).toBe(2 * tokenCount);
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT / 2);

    const billPayments = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload.token', '==', token.uid)
        .get()
    ).docs.map((d) => <Transaction>d.data());
    expect(billPayments.length).toBe(2);

    const billPaymentToSeller = billPayments.find(
      (bp) => bp.payload.amount === (MIN_IOTA_AMOUNT / 2) * (2 * tokenCount) + 800,
    );
    expect(billPaymentToSeller).toBeDefined();

    const billPaymentToSpaceOne = billPayments.find((bp) => bp.payload.amount === 800);
    expect(billPaymentToSpaceOne).toBeDefined();
  });

  it('Should fill buy and send dust to space one', async () => {
    await admin.firestore().doc(`${COL.MEMBER}/${seller}`).update({ tokenTradingFeePercentage: 1 });
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2,
      count: 2 * tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});

    await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2,
      count: 2 * tokenCount,
    });

    const purchaseQuery = admin
      .firestore()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', token.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.docs.length === 1;
    });

    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data();
    expect(purchase.count).toBe(2 * tokenCount);
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT / 2);

    const billPayments = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload.token', '==', token.uid)
        .get()
    ).docs.map((d) => <Transaction>d.data());

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
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: tokenCount,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});
    const request = { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: tokenCount };
    await buyTokenFunc(buyer, request);

    await wait(async () => {
      return (
        (
          await admin
            .firestore()
            .collection(COL.TOKEN_MARKET)
            .where('type', '==', TokenTradeOrderType.BUY)
            .where('owner', '==', buyer)
            .get()
        ).docs[0].data().status === TokenTradeOrderStatus.SETTLED
      );
    });
    const paymentSnap = await getBillPayments(buyer);
    expect(paymentSnap.docs.length).toBe(3);
    const sortedPayments = paymentSnap.docs.sort(
      (a, b) => a.data().payload.amount - b.data().payload.amount,
    );
    expect(sortedPayments.map((d) => d.data().payload.amount)).toEqual(
      getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount),
    );
    expect(sortedPayments.map((d) => d.data().ignoreWallet)).toEqual([true, false, undefined]);
  });

  it('Should cancel sell after half fulfilled', async () => {
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 10,
      type: TokenTradeOrderType.SELL,
    });
    const sell = await testEnv.wrap(tradeToken)({});
    await buyTokenFunc(buyer, { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: 5 });

    await wait(async () => {
      return (
        (
          await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get()
        ).docs[0]?.data()?.fulfilled === 5
      );
    });
    mockWalletReturnValue(walletSpy, seller, { uid: sell.uid });
    const cancelled = await testEnv.wrap(cancelTradeOrder)({});
    expect(cancelled.status).toBe(TokenTradeOrderStatus.PARTIALLY_SETTLED_AND_CANCELLED);

    const sellDistribution = <TokenDistribution>(
      (
        await admin
          .firestore()
          .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${seller}`)
          .get()
      ).data()
    );
    expect(sellDistribution.lockedForSale).toBe(0);
    expect(sellDistribution.sold).toBe(5);
    expect(sellDistribution.tokenOwned).toBe(tokenCount * 3 - 5);
  });

  it('Should fulfill buy with lowest sell', async () => {
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: 2 * MIN_IOTA_AMOUNT,
      count: 10,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 10,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});
    await buyTokenFunc(buyer, { symbol: token.symbol, price: 2 * MIN_IOTA_AMOUNT, count: 10 });

    await wait(async () => {
      return (
        (
          await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get()
        ).docs[0]?.data()?.fulfilled === 10
      );
    });

    const buys = (
      await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get()
    ).docs.map((d) => d.data());
    const purchase = <TokenPurchase>(
      (
        await admin.firestore().collection(COL.TOKEN_PURCHASE).where('buy', '==', buys[0].uid).get()
      ).docs[0].data()
    );
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT);
  });

  it('Should fulfill sell with highest buy', async () => {
    await buyTokenFunc(buyer, { symbol: token.symbol, price: 2 * MIN_IOTA_AMOUNT, count: 10 });
    await buyTokenFunc(buyer, { symbol: token.symbol, price: MIN_IOTA_AMOUNT, count: 10 });
    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('owner', '==', buyer)
        .get();
      const wasUpdated = snap.docs.reduce(
        (acc, act) => acc && !isEmpty(act.data().updatedOn),
        true,
      );
      return snap.size === 2 && wasUpdated;
    });

    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 10,
      type: TokenTradeOrderType.SELL,
    });
    const sell = <TokenTradeOrder>await testEnv.wrap(tradeToken)({});

    await wait(async () => {
      return (
        (
          await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller).get()
        ).docs[0]?.data()?.fulfilled === 10
      );
    });

    const purchase = <TokenPurchase>(
      (
        await admin.firestore().collection(COL.TOKEN_PURCHASE).where('sell', '==', sell.uid).get()
      ).docs[0].data()
    );
    expect(purchase.price).toBe(2 * MIN_IOTA_AMOUNT);
  });

  it('Should cancel after it needs higher fulfillment price', async () => {
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: 0.8 * MIN_IOTA_AMOUNT,
      count: 8,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});

    const request = {
      symbol: token.symbol,
      price: 0.82 * MIN_IOTA_AMOUNT,
      count: 10,
      type: TokenTradeOrderType.BUY,
    };
    await buyTokenFunc(buyer, request);

    const buyQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer);

    await wait(async () => {
      return (
        (await buyQuery.get()).docs[0]?.data()?.status ===
        TokenTradeOrderStatus.CANCELLED_UNFULFILLABLE
      );
    });

    expect((await buyQuery.get()).docs[0]?.data()?.status).toBe(
      TokenTradeOrderStatus.CANCELLED_UNFULFILLABLE,
    );
  });

  it('Should fulfill low price sell with high price buy', async () => {
    mockWalletReturnValue(walletSpy, seller, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT / 2,
      count: 100,
      type: TokenTradeOrderType.SELL,
    });
    await testEnv.wrap(tradeToken)({});

    const order = await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 99,
    });

    const buyQuery = admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('orderTransactionId', '==', order.uid);
    await wait(async () => {
      const buySnap = await buyQuery.get();
      return buySnap.docs[0].data().fulfilled === 99;
    });

    const order2 = await buyTokenFunc(buyer, {
      symbol: token.symbol,
      price: 2 * MIN_IOTA_AMOUNT,
      count: 1,
    });
    const buyQuery2 = admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('orderTransactionId', '==', order2.uid);
    await wait(async () => {
      const buySnap = await buyQuery2.get();
      return buySnap.docs[0].data().fulfilled === 1;
    });

    const buy = (await buyQuery2.get()).docs[0].data() as TokenTradeOrder;
    const purchase = (
      await admin.firestore().collection(COL.TOKEN_PURCHASE).where('buy', '==', buy.uid).get()
    ).docs[0].data() as TokenPurchase;
    expect(purchase.price).toBe(2 * MIN_IOTA_AMOUNT);
  });
});
