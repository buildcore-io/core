import dayjs from 'dayjs';
import bigDecimal from 'js-big-decimal';
import { DEFAULT_NETWORK, MIN_IOTA_AMOUNT, TOKEN_SALE, TOKEN_SALE_TEST, URL_PATHS } from '../../interfaces/config';
import { Network, Transaction, TransactionCreditType, TransactionType } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenBuySellOrder, TokenBuySellOrderStatus, TokenBuySellOrderType, TokenDistribution, TokenPurchase, TokenStatus } from "../../interfaces/models/token";
import admin from '../../src/admin.config';
import { buyToken, cancelBuyOrSell, sellToken } from "../../src/controls/token-buy-sell.controller";
import { cancelExpiredSale } from '../../src/cron/token.cron';
import { TOKEN_SALE_ORDER_FETCH_LIMIT } from "../../src/triggers/token-buy-sell.trigger";
import { getAddress } from '../../src/utils/address.utils';
import { cOn, dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { projectId, testEnv } from '../set-up';
import { createMember, createSpace, milestoneProcessed, mockWalletReturnValue, submitMilestoneFunc, wait } from "./common";

let walletSpy: any;

const buyTokenFunc = async (memberAddress: string, request: any) => {
  mockWalletReturnValue(walletSpy, memberAddress, request);
  const order = await testEnv.wrap(buyToken)({});
  const milestone = await submitMilestoneFunc(order.payload.targetAddress, Number(bigDecimal.floor(bigDecimal.multiply(request.price, request.count))));
  await milestoneProcessed(milestone.milestone, milestone.tranId);
  return order
}

const assertVolumeTotal = async (tokenId: string, volumeTotal: number) => {
  const statDoc = admin.firestore().doc(`${COL.TOKEN}/${tokenId}/${SUB_COL.STATS}/${tokenId}`)
  await wait(async () => (await statDoc.get()).data()?.volumeTotal === volumeTotal)
}

const createRoyaltySpaces = async () => {
  const spaceOneId = TOKEN_SALE_TEST.spaceone
  const spaceTwoId = TOKEN_SALE_TEST.spacetwo
  const guardian = await createMember(walletSpy, true);
  const spaceIdSpy = jest.spyOn(wallet, 'getRandomEthAddress');

  const spaceOneDoc = await admin.firestore().doc(`${COL.SPACE}/${spaceOneId}`).get()
  if (!spaceOneDoc.exists) {
    spaceIdSpy.mockReturnValue(spaceOneId)
    await createSpace(walletSpy, guardian, true);
  }

  const spaceTwoDoc = await admin.firestore().doc(`${COL.SPACE}/${spaceTwoId}`).get()
  if (!spaceTwoDoc.exists) {
    spaceIdSpy.mockReturnValue(spaceTwoId)
    await createSpace(walletSpy, guardian, true);
  }

  spaceIdSpy.mockRestore()
}

const getBillPayments = (seller: string) => admin.firestore().collection(COL.TRANSACTION)
  .where('type', '==', TransactionType.BILL_PAYMENT)
  .where('member', '==', seller)
  .get()

const { percentage, spaceonepercentage } = TOKEN_SALE_TEST

const getRoyaltyDistribution = (amount: number) => {
  const spaceOne = amount * (percentage / 100) * (spaceonepercentage / 100)
  const spaceTwo = amount * (percentage / 100) * (1 - (spaceonepercentage / 100))
  return [spaceOne, spaceTwo, amount - (spaceOne >= MIN_IOTA_AMOUNT ? spaceOne : 0) - (spaceTwo >= MIN_IOTA_AMOUNT ? spaceTwo : 0)]
}

describe('Buy sell trigger', () => {
  let seller: string;
  let buyer: string;

  let token: Token
  const tokenCount = 400

  const saveSellToDb = async (count: number, price: number) => {
    const data = cOn(<TokenBuySellOrder>{
      uid: wallet.getRandomEthAddress(),
      owner: seller,
      token: token.uid,
      type: TokenBuySellOrderType.SELL,
      count: count,
      price: price,
      totalDeposit: count * price,
      balance: 0,
      expiresAt: dateToTimestamp(dayjs()),
      fulfilled: 0,
      status: TokenBuySellOrderStatus.ACTIVE
    }, URL_PATHS.TOKEN_MARKET)
    await admin.firestore().doc(`${COL.TOKEN_MARKET}/${data.uid}`).create(data)
  }

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    seller = await createMember(walletSpy, true)
    buyer = await createMember(walletSpy, true)

    const tokenId = wallet.getRandomEthAddress()
    token = <Token>{ uid: tokenId, symbol: 'MYWO', name: 'MyToken', space: 'myspace', status: TokenStatus.PRE_MINTED, approved: true }
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).set(token);
    const distribution = <TokenDistribution>{ tokenOwned: tokenCount * 3 }
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}/${SUB_COL.DISTRIBUTION}/${seller}`).set(distribution);

    await createRoyaltySpaces()
  });

  it('Should fulfill buy with one sell', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: tokenCount });
    await testEnv.wrap(sellToken)({});

    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: tokenCount }
    const order = await buyTokenFunc(buyer, request)

    await wait(async () => {
      const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET).where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get()
      return buySnap.docs[0].data().fulfilled === tokenCount
    })

    const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET).where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get()
    expect(buySnap.docs.length).toBe(1)
    const buy = <TokenBuySellOrder>buySnap.docs[0].data()
    expect(buy.status).toBe(TokenBuySellOrderStatus.SETTLED)
    const sellDistribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${seller}`).get()).data()
    expect(sellDistribution.lockedForSale).toBe(0)
    expect(sellDistribution.sold).toBe(tokenCount)
    expect(sellDistribution.tokenOwned).toBe(2 * tokenCount)
    const buyDistribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${buyer}`).get()).data()
    expect(buyDistribution.totalPurchased).toBe(tokenCount)
    expect(buyDistribution.tokenOwned).toBe(tokenCount)

    const purchase = (await admin.firestore().collection(COL.TOKEN_PURCHASE).where('buy', '==', buy.uid).get()).docs
    expect(purchase.length).toBe(1)
    expect(purchase[0].data().buy).toBe(buy.uid)
    expect(purchase[0].data().sell).toBeDefined()
    expect(purchase[0].data().price).toBe(MIN_IOTA_AMOUNT)
    expect(purchase[0].data().count).toBe(tokenCount)

    const sellerAddress = (await admin.firestore().doc(`${COL.MEMBER}/${seller}`).get()).data()?.validatedAddress
    const billPayment = await admin.firestore().doc(`${COL.TRANSACTION}/${purchase[0].data().billPaymentId}`).get()
    expect(billPayment.exists).toBe(true)
    expect(billPayment.data()?.payload?.sourceAddress).toBe(order.payload.targetAddress)
    expect(billPayment.data()?.payload?.targetAddress).toBe(getAddress(sellerAddress, Network.IOTA))

    const paymentSnap = await getBillPayments(buyer)
    expect(paymentSnap.docs.length).toBe(3)
    const payments = paymentSnap.docs.sort((a, b) => a.data().payload.amount - b.data().payload.amount)
    expect(payments.map(d => d.data().payload.amount)).toEqual(getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount))
    expect(payments.map(d => d.data().ignoreWallet)).toEqual([false, false, undefined])

    payments.forEach(p => {
      expect(p.data()?.payload?.previousOwner).toBe(seller)
      expect(p.data()?.member).toBe(buyer)
    })

    await assertVolumeTotal(token.uid, tokenCount)
  })

  it('Should fulfill buy with one sell, same owner', async () => {
    buyer = seller

    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: tokenCount });
    await testEnv.wrap(sellToken)({});

    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: tokenCount }
    const order = await buyTokenFunc(buyer, request)

    await wait(async () => {
      const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET).where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get()
      return buySnap.docs[0].data().fulfilled === tokenCount
    })

    const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET).where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get()
    expect(buySnap.docs.length).toBe(1)
    const buy = <TokenBuySellOrder>buySnap.docs[0].data()
    expect(buy.status).toBe(TokenBuySellOrderStatus.SETTLED)
    const buyDistribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${buyer}`).get()).data()
    expect(buyDistribution.totalPurchased).toBe(tokenCount)
    expect(buyDistribution.tokenOwned).toBe(3 * tokenCount)

    const purchase = (await admin.firestore().collection(COL.TOKEN_PURCHASE).where('buy', '==', buy.uid).get()).docs
    expect(purchase.length).toBe(1)
    expect(purchase[0].data().buy).toBe(buy.uid)
    expect(purchase[0].data().sell).toBeDefined()
    expect(purchase[0].data().price).toBe(MIN_IOTA_AMOUNT)
    expect(purchase[0].data().count).toBe(tokenCount)

    const sellerAddress = (await admin.firestore().doc(`${COL.MEMBER}/${seller}`).get()).data()?.validatedAddress
    const billPayment = await admin.firestore().doc(`${COL.TRANSACTION}/${purchase[0].data().billPaymentId}`).get()
    expect(billPayment.exists).toBe(true)
    const payload = billPayment.data()?.payload
    expect(payload?.sourceAddress).toBe(order.payload.targetAddress)
    expect(payload?.targetAddress).toBe(getAddress(sellerAddress, Network.IOTA))

    const paymentSnap = await getBillPayments(buyer)
    expect(paymentSnap.docs.length).toBe(3)
    const payments = paymentSnap.docs.sort((a, b) => a.data().payload.amount - b.data().payload.amount)
    expect(payments.map(d => d.data().payload.amount)).toEqual(getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount))
    expect(payments.map(d => d.data().ignoreWallet)).toEqual([false, false, undefined])

    payments.forEach(p => {
      expect(p.data()?.payload?.previousOwner).toBe(seller)
      expect(p.data()?.member).toBe(buyer)
    })

    await assertVolumeTotal(token.uid, tokenCount)
  })

  it('Should fulfill buy with two sell and credit owner', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: tokenCount });
    await testEnv.wrap(sellToken)({});
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: tokenCount });
    await testEnv.wrap(sellToken)({});

    const request = { token: token.uid, price: MIN_IOTA_AMOUNT * 2, count: 2 * tokenCount }
    const order = await buyTokenFunc(buyer, request)

    await wait(async () => {
      const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET).where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get()
      return buySnap.docs[0].data().fulfilled === 2 * tokenCount
    })

    const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET).where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get()
    expect(buySnap.docs.length).toBe(1)
    const buy = <TokenBuySellOrder>buySnap.docs[0].data()
    expect(buy.status).toBe(TokenBuySellOrderStatus.SETTLED)

    const credit = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${buy.creditTransactionId}`).get()).data()
    expect(credit.payload.amount).toBe(MIN_IOTA_AMOUNT * 2 * tokenCount)
    expect(credit.payload.sourceTransaction).toContain(buySnap.docs[0].data().paymentTransactionId)
    expect(credit?.payload?.sourceAddress).toBe(order.payload.targetAddress)
    const buyerAddress = (await admin.firestore().doc(`${COL.MEMBER}/${buyer}`).get()).data()?.validatedAddress
    expect(credit?.payload?.targetAddress).toBe(getAddress(buyerAddress, Network.IOTA))
    expect(credit.targetNetwork).toBe(DEFAULT_NETWORK)

    const paymentSnap = await getBillPayments(buyer)
    expect(paymentSnap.docs.length).toBe(6)
    const amounts = paymentSnap.docs.map(d => d.data().payload.amount).sort((a, b) => a - b)
    expect(amounts).toEqual([...getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount), ...getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount)].sort((a, b) => a - b))
    paymentSnap.docs.forEach(doc => expect(doc.data()?.targetNetwork).toBe(DEFAULT_NETWORK))

    await assertVolumeTotal(token.uid, 2 * tokenCount)
  })

  it('Should fulfill sell with two buy', async () => {
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: tokenCount }
    await buyTokenFunc(buyer, request);
    await buyTokenFunc(buyer, request);

    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 2 * tokenCount });
    await testEnv.wrap(sellToken)({});

    await wait(async () => {
      const sellSnap = await admin.firestore().collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenBuySellOrderType.SELL).where('owner', '==', seller).get()
      return sellSnap.docs[0].data().fulfilled === 2 * tokenCount
    })

    const sellSnap = await admin.firestore().collection(COL.TOKEN_MARKET).where('type', '==', TokenBuySellOrderType.SELL).where('owner', '==', seller).get()
    expect(sellSnap.docs.length).toBe(1)
    const sell = <TokenBuySellOrder>sellSnap.docs[0].data()
    expect(sell.status).toBe(TokenBuySellOrderStatus.SETTLED)
    expect(sell.fulfilled).toBe(2 * tokenCount)

    await assertVolumeTotal(token.uid, 2 * tokenCount)
  })

  it('Should sell tokens in two transactions', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 2 * tokenCount });
    await testEnv.wrap(sellToken)({});
    await buyTokenFunc(buyer, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 2 * tokenCount });

    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: tokenCount });
    await testEnv.wrap(sellToken)({});
    await buyTokenFunc(buyer, { token: token.uid, price: MIN_IOTA_AMOUNT, count: tokenCount });

    await wait(async () => {
      const distribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${seller}`).get()).data();
      return distribution.tokenOwned === 0 && distribution.sold === 3 * tokenCount
    })
  })

  it('Should buy in parallel', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 2 * tokenCount });
    await testEnv.wrap(sellToken)({});
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: tokenCount }
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
    expect(sales.length).toBe(3)
    const buyFulfillmentCount = sales.reduce((sum, sale) => sum + (sale.type === TokenBuySellOrderType.BUY ? sale.fulfilled : 0), 0)
    expect(buyFulfillmentCount).toBe(2 * tokenCount)
    const sellFulfillmentCount = sales.reduce((sum, sale) => sum + (sale.type === TokenBuySellOrderType.SELL ? sale.fulfilled : 0), 0)
    expect(sellFulfillmentCount).toBe(2 * tokenCount)

    await assertVolumeTotal(token.uid, 2 * tokenCount)
  })

  it('Should buy and sell in parallel', async () => {
    const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${seller}`)
    const distribution = <TokenDistribution>{ tokenOwned: 3 * tokenCount }
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
        totalDeposit: count * price,
        balance: 0,
        expiresAt: dateToTimestamp(dayjs()),
        fulfilled: 0,
        status: TokenBuySellOrderStatus.ACTIVE,
      }, URL_PATHS.TOKEN_MARKET)
      await admin.firestore().doc(`${COL.TOKEN_MARKET}/${sellDocId}`).create(data)
      await distributionDocRef.update({ lockedForSale: admin.firestore.FieldValue.increment(count) })
    }

    const buyRequest = { token: token.uid, price: MIN_IOTA_AMOUNT, count: tokenCount }
    const promises = [
      buyTokenFunc(buyer, buyRequest),
      buyTokenFunc(buyer, buyRequest),
      sellTokenFunc(2 * tokenCount, MIN_IOTA_AMOUNT),
      buyTokenFunc(buyer, buyRequest),
      sellTokenFunc(tokenCount, MIN_IOTA_AMOUNT)
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
    expect(sellDistribution.sold).toBe(3 * tokenCount)
    expect(sellDistribution.lockedForSale).toBe(0)
    expect(sellDistribution.tokenOwned).toBe(0)
    const buyDistribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${buyer}`).get()).data()
    expect(buyDistribution.totalPurchased).toBe(3 * tokenCount)
    expect(buyDistribution.tokenOwned).toBe(3 * tokenCount)

    const paymentSnap = await getBillPayments(buyer)
    expect(paymentSnap.docs.length).toBe(9)
    const amounts = paymentSnap.docs.map(d => d.data().payload.amount).sort((a, b) => a - b)
    const sortedAmount = getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount)
    expect(amounts).toEqual([...sortedAmount, ...sortedAmount, ...sortedAmount].sort((a, b) => a - b))

    await assertVolumeTotal(token.uid, 3 * tokenCount)
  })

  it('Should cancel buy after half fulfilled', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: tokenCount });
    await testEnv.wrap(sellToken)({});
    await buyTokenFunc(buyer, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 2 * tokenCount })

    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).where('type', '==', TokenBuySellOrderType.BUY).get()
      return snap.docs[0].data().fulfilled === tokenCount
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
    expect(creditSnap.docs[0].data()?.payload?.amount).toBe(tokenCount * MIN_IOTA_AMOUNT)

    await assertVolumeTotal(token.uid, tokenCount)
  })

  it('Should cancel buy after half fulfilled, decimal values', async () => {
    const tokenCount = 7
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT + 0.1, count: tokenCount });
    await testEnv.wrap(sellToken)({});
    await buyTokenFunc(buyer, { token: token.uid, price: MIN_IOTA_AMOUNT + 0.1, count: 2 * tokenCount })

    await wait(async () => {
      return (await admin.firestore()
        .collection(COL.TOKEN_MARKET)
        .where('owner', '==', buyer)
        .get()
      ).docs[0]?.data()?.fulfilled === tokenCount
    })

    const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get()
    expect(buySnap.docs.length).toBe(1)
    const buy = <TokenBuySellOrder>buySnap.docs[0].data()
    const cancelRequest = { uid: buy.uid }
    mockWalletReturnValue(walletSpy, buyer, cancelRequest);
    const cancelled = await testEnv.wrap(cancelBuyOrSell)({});
    expect(cancelled.status).toBe(TokenBuySellOrderStatus.PARTIALLY_SETTLED_AND_CANCELLED)
    const creditSnap = await admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', buyer)
      .where('payload.type', '==', TransactionCreditType.TOKEN_BUY)
      .get()
    expect(creditSnap.docs.length).toBe(1)
    expect(creditSnap.docs[0].data()?.payload?.amount).toBe(tokenCount * MIN_IOTA_AMOUNT + 1)
  })

  it('Should settle after second run on more than batch limit', async () => {
    const distribution = <TokenDistribution>{ tokenOwned: 70 * tokenCount }
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${seller}`).set(distribution);

    const promises = Array.from(Array(TOKEN_SALE_ORDER_FETCH_LIMIT + 50)).map(() => saveSellToDb(1, MIN_IOTA_AMOUNT))
    await Promise.all(promises)

    const count = TOKEN_SALE_ORDER_FETCH_LIMIT + 20

    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count }
    await buyTokenFunc(buyer, request)

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

  it('Should settle after multiple runs, all too small, last one is ok', async () => {
    const promises = Array.from(Array(100)).map(() => saveSellToDb(1, 1))
    await Promise.all(promises)
    await saveSellToDb(1, MIN_IOTA_AMOUNT)

    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 1 }
    await buyTokenFunc(buyer, request)

    await wait(async () => {
      return (await admin.firestore().collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get())
        .docs[0].data().status === TokenBuySellOrderStatus.SETTLED
    })
    const buyDocs = (await admin.firestore().collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get()).docs
    expect(buyDocs.length).toBe(1)
    expect(buyDocs[0].data()?.fulfilled).toBe(1)
    expect(buyDocs[0].data()?.status).toBe(TokenBuySellOrderStatus.SETTLED)

    const purchases = (await admin.firestore().collection(COL.TOKEN_PURCHASE).where('buy', '==', buyDocs[0].data()?.uid).get()).docs
    expect(purchases.length).toBe(1)
  })

  it('Should not fill buy, balance would be less then MIN_IOTA_AMOUNT', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: tokenCount });
    await testEnv.wrap(sellToken)({});

    await buyTokenFunc(buyer, { token: token.uid, price: MIN_IOTA_AMOUNT + 1000, count: tokenCount })

    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get()
      return snap.docs.length === 1 && snap.docs[0].data().updatedOn !== undefined
    })

    const buyDocs = (await admin.firestore().collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get()).docs
    expect(buyDocs.length).toBe(1)
    expect(buyDocs[0].data()?.fulfilled).toBe(0)
  })

  it('Should not fill buy, max buy balance would be less then MIN_IOTA_AMOUNT', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT / 4, count: 4 });
    await testEnv.wrap(sellToken)({});

    await buyTokenFunc(buyer, { token: token.uid, price: MIN_IOTA_AMOUNT / 2, count: 5 })

    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer).get()
      return snap.docs.length === 1 && snap.docs[0].data().updatedOn !== undefined
    })

    const buyDocs = (await admin.firestore().collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get()).docs
    expect(buyDocs.length).toBe(1)
    expect(buyDocs[0].data()?.fulfilled).toBe(0)
  })

  it('Should fulfill buy but only create one space bill payment', async () => {
    const tokenCount = 100
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: tokenCount });
    await testEnv.wrap(sellToken)({});
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: tokenCount }
    await buyTokenFunc(buyer, request)

    await wait(async () => {
      return (await admin.firestore().collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get())
        .docs[0].data().status === TokenBuySellOrderStatus.SETTLED
    })
    const paymentSnap = await getBillPayments(buyer)
    expect(paymentSnap.docs.length).toBe(3)
    const sortedPayments = paymentSnap.docs.sort((a, b) => a.data().payload.amount - b.data().payload.amount)
    expect(sortedPayments.map(d => d.data().payload.amount)).toEqual(getRoyaltyDistribution(MIN_IOTA_AMOUNT * tokenCount))
    expect(sortedPayments.map(d => d.data().ignoreWallet)).toEqual([true, false, undefined])
  })

  it('Should make sale expired after buy and can not be fulfilled further', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT / 2, count: tokenCount });
    const sell = await testEnv.wrap(sellToken)({});

    const request = { token: token.uid, price: MIN_IOTA_AMOUNT / 2, count: tokenCount - 1 }
    await buyTokenFunc(buyer, request)

    await wait(async () => {
      const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET).where('type', '==', TokenBuySellOrderType.BUY).where('owner', '==', buyer).get()
      return buySnap.docs[0].data().fulfilled === tokenCount - 1
    })

    const sellData = <TokenBuySellOrder>(await admin.firestore().doc(`${COL.TOKEN_MARKET}/${sell.uid}`).get()).data()
    expect(dayjs(sellData.expiresAt.toDate()).isBefore(dayjs())).toBe(true)
    expect(sellData.fulfilled === tokenCount - 1)

    await cancelExpiredSale()

    const sellDistribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${seller}`).get()).data()
    expect(sellDistribution.lockedForSale).toBe(0)
    expect(sellDistribution.sold).toBe(tokenCount - 1)
    expect(sellDistribution.tokenOwned).toBe(2 * tokenCount + 1)
  })

  it('Should cancel sell after half fulfilled', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 10 });
    const sell = await testEnv.wrap(sellToken)({});
    await buyTokenFunc(buyer, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 })

    await wait(async () => {
      return (await admin.firestore()
        .collection(COL.TOKEN_MARKET)
        .where('owner', '==', buyer)
        .get()
      ).docs[0]?.data()?.fulfilled === 5
    })

    const cancelRequest = { uid: sell.uid }
    mockWalletReturnValue(walletSpy, seller, cancelRequest);
    await testEnv.wrap(cancelBuyOrSell)({});

    const sellDistribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${seller}`).get()).data()
    expect(sellDistribution.lockedForSale).toBe(0)
    expect(sellDistribution.sold).toBe(5)
    expect(sellDistribution.tokenOwned).toBe(tokenCount * 3 - 5)
  })

  it('Should fulfill buy with lowest sell', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: 2 * MIN_IOTA_AMOUNT, count: 10 });
    await testEnv.wrap(sellToken)({});
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 10 });
    await testEnv.wrap(sellToken)({});
    await buyTokenFunc(buyer, { token: token.uid, price: 2 * MIN_IOTA_AMOUNT, count: 10 })

    await wait(async () => {
      return (await admin.firestore()
        .collection(COL.TOKEN_MARKET)
        .where('owner', '==', buyer)
        .get()
      ).docs[0]?.data()?.fulfilled === 10
    })

    const buys = (await admin.firestore()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', buyer)
      .get()).docs.map(d => d.data())
    const purchase = <TokenPurchase>(await admin.firestore().collection(COL.TOKEN_PURCHASE).where('buy', '==', buys[0].uid).get()).docs[0].data()
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT)
  })

  it('Should fulfill sell with the lowest buy', async () => {
    await buyTokenFunc(buyer, { token: token.uid, price: 2 * MIN_IOTA_AMOUNT, count: 10 })
    await buyTokenFunc(buyer, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 10 })
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: MIN_IOTA_AMOUNT, count: 10 });
    const sell = <TokenBuySellOrder>await testEnv.wrap(sellToken)({});

    await wait(async () => {
      return (await admin.firestore()
        .collection(COL.TOKEN_MARKET)
        .where('owner', '==', seller)
        .get()
      ).docs[0]?.data()?.fulfilled === 10
    })

    const purchase = <TokenPurchase>(await admin.firestore().collection(COL.TOKEN_PURCHASE).where('sell', '==', sell.uid).get()).docs[0].data()
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT)
  })

  it('Should fulfill only on retry', async () => {
    mockWalletReturnValue(walletSpy, seller, { token: token.uid, price: 2 * MIN_IOTA_AMOUNT, count: tokenCount });
    const sell: TokenBuySellOrder = await testEnv.wrap(sellToken)({});
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: tokenCount }
    await buyTokenFunc(buyer, request)

    await new Promise(resolve => setTimeout(resolve, 3000));
    expect(sell.fulfilled).toBe(0)

    const sellDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${sell.uid}`)
    await sellDocRef.update({ price: MIN_IOTA_AMOUNT, shouldRetry: true })

    await wait(async () => {
      return (await sellDocRef.get()).data()?.fulfilled === tokenCount
    })

    expect((await sellDocRef.get()).data()?.shouldRetry).toBe(false)
  })
})

describe('Expired sales cron', () => {
  let seller: string;

  let token: Token

  beforeEach(async () => {
    if (process.env.LOCAL_TEST) {
      await testEnv.firestore.clearFirestoreData({ projectId })
    }
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
      totalDeposit: MIN_IOTA_AMOUNT,
      balance: 0,
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
      const snap = await admin.firestore().collection(COL.TOKEN_MARKET)
        .where('owner', '==', seller)
        .where('status', '==', TokenBuySellOrderStatus.ACTIVE)
        .get()
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
