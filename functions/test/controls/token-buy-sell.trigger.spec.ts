import dayjs from 'dayjs';
import { MIN_IOTA_AMOUNT, URL_PATHS } from '../../interfaces/config';
import { Transaction, TransactionCreditType, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenBuySellOrder, TokenBuySellOrderStatus, TokenBuySellOrderType, TokenDistribution, TokenStatus } from "../../interfaces/models/token";
import admin from '../../src/admin.config';
import { buyToken, cancelBuyOrSell, sellToken } from "../../src/controls/token-buy-sell.controller";
import { TOKEN_SALE_ORDER_FETCH_LIMIT } from "../../src/triggers/token-buy-sell.trigger";
import { cOn, dateToTimestamp } from '../../src/utils/dateTime.utils';
import { cancelExpiredSale } from '../../src/utils/token-buy-sell.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { createMember, milestoneProcessed, mockWalletReturnValue, submitMilestoneFunc, wait } from "./common";

let walletSpy: any;

const buyTokenFunc = async (memberAddress: string, request: any) => {
  mockWalletReturnValue(walletSpy, memberAddress, request);
  const order = await testEnv.wrap(buyToken)({});
  const milestone = await submitMilestoneFunc(order.payload.targetAddress, request.price * request.count);
  await milestoneProcessed(milestone.milestone, milestone.tranId);
}

describe('Buy sell trigger', () => {
  let seller: string;
  let buyer: string;

  let token: Token

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    seller = await createMember(walletSpy, true)
    buyer = await createMember(walletSpy, true)

    const tokenId = wallet.getRandomEthAddress()
    token = <Token>{ uid: tokenId, symbol: 'MYWO', name: 'MyToken', space: 'myspace', status: TokenStatus.PRE_MINTED, approved: true }
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).set(token);
    const distribution = <TokenDistribution>{ tokenOwned: 10 }
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}/${SUB_COL.DISTRIBUTION}/${seller}`).set(distribution);
  });

  it('Should fulfill buy with one sell', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 });
    await testEnv.wrap(sellToken)({});

    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    mockWalletReturnValue(walletSpy, buyer, request);
    const order = await testEnv.wrap(buyToken)({});

    const milestone = await submitMilestoneFunc(order.payload.targetAddress, MIN_IOTA_AMOUNT * 5);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    await wait(async () => {
      const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET).where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get()
      return buySnap.docs[0].data().fulfilled === 5
    })

    const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET).where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get()
    expect(buySnap.docs.length).toBe(1)
    const buy = <TokenBuySellOrder>buySnap.docs[0].data()
    expect(buy.status).toBe(TokenBuySellOrderStatus.SETTLED)
    const sellDistribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${seller}`).get()).data()
    expect(sellDistribution.lockedForSale).toBe(0)
    expect(sellDistribution.sold).toBe(5)
    expect(sellDistribution.tokenOwned).toBe(5)
    const buyDistribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${buyer}`).get()).data()
    expect(buyDistribution.totalPurchased).toBe(5)
    expect(buyDistribution.tokenOwned).toBe(5)

    const purchase = (await admin.firestore().collection(COL.TOKEN_PURCHASE).where('buy', '==', buy.uid).get()).docs
    expect(purchase.length).toBe(1)
    expect(purchase[0].data().buy).toBe(buy.uid)
    expect(purchase[0].data().sell).toBeDefined()
    expect(purchase[0].data().price).toBe(MIN_IOTA_AMOUNT)
    expect(purchase[0].data().count).toBe(5)

    const billPayment = await admin.firestore().doc(`${COL.TRANSACTION}/${purchase[0].data().billPaymentId}`).get()
    expect(billPayment.exists).toBe(true)
    expect(billPayment.data()?.payload?.sourceAddress).toBe(order.payload.targetAddress)
    const sellerAddress = (await admin.firestore().doc(`${COL.MEMBER}/${seller}`).get()).data()?.validatedAddress
    expect(billPayment.data()?.payload?.targetAddress).toBe(sellerAddress)

    const paymentSnap = await admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', seller)
      .get()
    expect(paymentSnap.docs.length).toBe(1)
    expect(paymentSnap.docs[0].data().payload.amount).toBe(MIN_IOTA_AMOUNT * 5)
  })

  it('Should fulfill buy with two sell and credit owner', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 2 });
    await testEnv.wrap(sellToken)({});
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 3 });
    await testEnv.wrap(sellToken)({});

    const request = { token: token.uid, price: MIN_IOTA_AMOUNT * 2, count: 5 }
    mockWalletReturnValue(walletSpy, buyer, request);
    const order = await testEnv.wrap(buyToken)({});
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, MIN_IOTA_AMOUNT * 2 * 5);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    await wait(async () => {
      const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET).where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get()
      return buySnap.docs[0].data().fulfilled === 5
    })

    const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET).where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get()
    expect(buySnap.docs.length).toBe(1)
    const buy = <TokenBuySellOrder>buySnap.docs[0].data()
    expect(buy.status).toBe(TokenBuySellOrderStatus.SETTLED)

    const credit = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${buy.creditTransactionId}`).get()).data()
    expect(credit.payload.amount).toBe(MIN_IOTA_AMOUNT * 5)
    expect(credit.payload.sourceTransaction).toContain(buySnap.docs[0].data().paymentTransactionId)
    expect(credit?.payload?.sourceAddress).toBe(order.payload.targetAddress)
    const buyerAddress = (await admin.firestore().doc(`${COL.MEMBER}/${buyer}`).get()).data()?.validatedAddress
    expect(credit?.payload?.targetAddress).toBe(buyerAddress)

    const paymentSnap = await admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', seller)
      .get()
    expect(paymentSnap.docs.length).toBe(2)
    const amounts = paymentSnap.docs.map(doc => doc.data().payload.amount).sort()
    expect(amounts).toEqual([2 * MIN_IOTA_AMOUNT, 3 * MIN_IOTA_AMOUNT])
  })

  it('Should fulfill sell with two buy', async () => {
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    await buyTokenFunc(buyer, request);
    await buyTokenFunc(buyer, request);

    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 10 });
    await testEnv.wrap(sellToken)({});

    await wait(async () => {
      const sellSnap = await admin.firestore().collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenBuySellOrderType.SELL).where('owner', '==', seller).get()
      return sellSnap.docs[0].data().fulfilled === 10
    })

    const sellSnap = await admin.firestore().collection(COL.TOKEN_MARKET).where('type', '==', TokenBuySellOrderType.SELL).where('owner', '==', seller).get()
    expect(sellSnap.docs.length).toBe(1)
    const sell = <TokenBuySellOrder>sellSnap.docs[0].data()
    expect(sell.status).toBe(TokenBuySellOrderStatus.SETTLED)
    expect(sell.fulfilled).toBe(10)
  })

  it('Should buy in parallel', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 10 });
    await testEnv.wrap(sellToken)({});
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    const promises = [buyTokenFunc(buyer, request), buyTokenFunc(buyer, request)]
    await Promise.all(promises)

    await wait(async () => {
      const allSettled = (
        await admin.firestore()
          .collection(COL.TOKEN_MARKET)
          .where('owner', '==', buyer)
          .get()
      ).docs.map(d => <TokenBuySellOrder>d.data())
        .reduce((sum, act) => sum && act.status === TokenBuySellOrderStatus.SETTLED, true)
      return allSettled
    })

    const sales = (await admin.firestore()
      .collection(COL.TOKEN_MARKET)
      .where('owner', 'in', [seller, buyer])
      .get()
    ).docs.map(d => <TokenBuySellOrder>d.data())
    const buyFulfillmentCount = sales.reduce((sum, sale) => sum + (sale.type === TokenBuySellOrderType.BUY ? sale.fulfilled : 0), 0)
    expect(buyFulfillmentCount).toBe(10)
    const sellFulfillmentCount = sales.reduce((sum, sale) => sum + (sale.type === TokenBuySellOrderType.SELL ? sale.fulfilled : 0), 0)
    expect(sellFulfillmentCount).toBe(10)
  })

  it('Should buy and sell in parallel', async () => {
    const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${seller}`)
    const distribution = <TokenDistribution>{ tokenOwned: 15 }
    await distributionDocRef.set(distribution);
    const sellTokenFunc = async (count: number, price: number) => {
      const sellDocId = wallet.getRandomEthAddress();
      const data = cOn(<TokenBuySellOrder>{
        uid: sellDocId,
        owner: seller,
        token: token.uid,
        type: TokenBuySellOrderType.SELL,
        count: count,
        price: price,
        fulfilled: 0,
        status: TokenBuySellOrderStatus.ACTIVE,
      }, URL_PATHS.TOKEN_MARKET)
      await admin.firestore().doc(`${COL.TOKEN_MARKET}/${sellDocId}`).create(data)
      await distributionDocRef.update({ lockedForSale: admin.firestore.FieldValue.increment(count) })
    }

    const buyRequest = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    const promises = [
      buyTokenFunc(buyer, buyRequest),
      buyTokenFunc(buyer, buyRequest),
      sellTokenFunc(10, MIN_IOTA_AMOUNT),
      buyTokenFunc(buyer, buyRequest),
      sellTokenFunc(5, MIN_IOTA_AMOUNT)
    ]
    await Promise.all(promises)

    await wait(async () => {
      const allSettled = (await admin.firestore()
        .collection(COL.TOKEN_MARKET)
        .where('owner', 'in', [seller, buyer])
        .get()
      ).docs.map(d => <TokenBuySellOrder>d.data()).reduce((sum, act) => sum && act.status === TokenBuySellOrderStatus.SETTLED, true)
      return allSettled
    })

    const sales = (await admin.firestore()
      .collection(COL.TOKEN_MARKET)
      .where('owner', 'in', [seller, buyer])
      .get()
    ).docs.map(d => <TokenBuySellOrder>d.data())

    const allSettled = sales.reduce((sum, act) => sum && act.status === TokenBuySellOrderStatus.SETTLED, true)
    expect(allSettled).toBe(true)

    const sellDistribution = <TokenDistribution>(await distributionDocRef.get()).data()
    expect(sellDistribution.sold).toBe(15)
    expect(sellDistribution.lockedForSale).toBe(0)
    expect(sellDistribution.tokenOwned).toBe(0)
    const buyDistribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${buyer}`).get()).data()
    expect(buyDistribution.totalPurchased).toBe(15)
    expect(buyDistribution.tokenOwned).toBe(15)

    const paymentSnap = await admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', seller)
      .get()
    expect(paymentSnap.docs.length).toBe(3)
    const amounts = paymentSnap.docs.map(doc => doc.data().payload.amount).sort()
    expect(amounts).toEqual([5 * MIN_IOTA_AMOUNT, 5 * MIN_IOTA_AMOUNT, 5 * MIN_IOTA_AMOUNT])
  })

  it('Should settle after second run on more than batch limit', async () => {
    const distribution = <TokenDistribution>{ tokenOwned: 120 }
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${seller}`).set(distribution);
    const sellTokenFunc = async (count: number, price: number) => {
      const sellDocId = wallet.getRandomEthAddress();
      const data = cOn(<TokenBuySellOrder>{
        uid: sellDocId,
        owner: seller,
        token: token.uid,
        type: TokenBuySellOrderType.SELL,
        count: count,
        price: price,
        fulfilled: 0,
        status: TokenBuySellOrderStatus.ACTIVE
      }, URL_PATHS.TOKEN_MARKET)
      await admin.firestore().doc(`${COL.TOKEN_MARKET}/${sellDocId}`).create(data)
    }
    const promises = Array.from(Array(TOKEN_SALE_ORDER_FETCH_LIMIT + 50)).map(() => sellTokenFunc(1, MIN_IOTA_AMOUNT))
    await Promise.all(promises)

    const count = TOKEN_SALE_ORDER_FETCH_LIMIT + 20

    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count }
    mockWalletReturnValue(walletSpy, buyer, request);
    const order = await testEnv.wrap(buyToken)({});
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, MIN_IOTA_AMOUNT * count);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    await wait(async () => {
      return (await admin.firestore().collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get())
        .docs[0].data().status === TokenBuySellOrderStatus.SETTLED
    })

    const buyDocs = (await admin.firestore().collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get()).docs
    expect(buyDocs.length).toBe(1)
    expect(buyDocs[0].data()?.fulfilled).toBe(count)
    expect(buyDocs[0].data()?.status).toBe(TokenBuySellOrderStatus.SETTLED)

    const purchases = (await admin.firestore().collection(COL.TOKEN_PURCHASE).where('buy', '==', buyDocs[0].data()?.uid).get()).docs
    expect(purchases.length).toBe(count)
  })

  it('Should cancel buy after half fulfilled', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 });
    await testEnv.wrap(sellToken)({});
    await buyTokenFunc(buyer, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 10 })

    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).where('type', '==', TokenBuySellOrderType.BUY).get()
      return snap.docs[0].data().fulfilled === 5
    })

    const snap = await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).where('type', '==', TokenBuySellOrderType.BUY).get()
    mockWalletReturnValue(walletSpy, buyer, { uid: snap.docs[0].id });
    const cancelled = await testEnv.wrap(cancelBuyOrSell)({});
    expect(cancelled.status).toBe(TokenBuySellOrderStatus.PARTIALLY_SETTLED_AND_CANCELLED)
    const creditSnap = await admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', buyer)
      .where('payload.type', '==', TransactionCreditType.TOKEN_BUY)
      .get()
    expect(creditSnap.docs.length).toBe(1)
    expect(creditSnap.docs[0].data()?.payload?.amount).toBe(5 * MIN_IOTA_AMOUNT)
  })
})

describe('Expired sales cron', () => {
  let seller: string;

  let token: Token

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    seller = await createMember(walletSpy, true)

    const tokenId = wallet.getRandomEthAddress()
    token = <Token>{ uid: tokenId, symbol: 'MYWO', name: 'MyToken', space: 'myspace', status: TokenStatus.PRE_MINTED, approved: true }
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).set(token);
    const distribution = <TokenDistribution>{ tokenOwned: 1000 }
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}/${SUB_COL.DISTRIBUTION}/${seller}`).set(distribution);
  });

  it('Should cancel all expired sales', async () => {
    const salesCount = 160
    const getDummySell = (status: TokenBuySellOrderStatus, type: TokenBuySellOrderType): TokenBuySellOrder => ({
      uid: wallet.getRandomEthAddress(),
      owner: seller,
      token: token.uid,
      type,
      count: 1,
      price: MIN_IOTA_AMOUNT,
      fulfilled: 0,
      status,
      expiresAt: dateToTimestamp(dayjs().subtract(1, 'minute')),
    })
    const createSales = (status: TokenBuySellOrderStatus, type: TokenBuySellOrderType, count: number) =>
      Array.from(Array(count)).map(async () => {
        const sell = getDummySell(status, type);
        await admin.firestore().doc(`${COL.TOKEN_MARKET}/${sell.uid}`).create(sell)
        return sell;
      })

    await Promise.all(createSales(TokenBuySellOrderStatus.ACTIVE, TokenBuySellOrderType.SELL, salesCount))
    await Promise.all(createSales(TokenBuySellOrderStatus.SETTLED, TokenBuySellOrderType.SELL, 3))

    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller).get()
      const processed = snap.docs.reduce((sum, act) => sum && (<TokenBuySellOrder>act.data()).updatedOn !== undefined, true)
      return processed
    })

    await cancelExpiredSale()

    const snap = await admin.firestore().collection(COL.TOKEN_MARKET)
      .where('owner', '==', seller)
      .where('status', '==', TokenBuySellOrderStatus.EXPIRED).get()
    expect(snap.docs.length).toBe(salesCount)
  })
})
