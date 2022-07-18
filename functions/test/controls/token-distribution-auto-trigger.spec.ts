import dayjs from "dayjs";
import bigDecimal from 'js-big-decimal';
import { isEmpty } from "lodash";
import { MIN_IOTA_AMOUNT } from "../../interfaces/config";
import { Network, Space, Transaction, TransactionType } from "../../interfaces/models";
import { COL, SUB_COL } from "../../interfaces/models/base";
import { Token, TokenDistribution, TokenStatus } from "../../interfaces/models/token";
import admin from '../../src/admin.config';
import { orderToken } from "../../src/controls/token.control";
import { getAddress } from "../../src/utils/address.utils";
import { dateToTimestamp, serverTime } from "../../src/utils/dateTime.utils";
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from "../set-up";
import { createMember, createSpace, milestoneProcessed, mockWalletReturnValue, submitMilestoneFunc, tokenProcessed } from "./common";

let walletSpy: any;

interface Inputs {
  readonly totalDeposit: number[];
  readonly totalPaid: number[];
  readonly refundedAmount: number[];
  readonly tokenOwned: number[];
  readonly paymentAmount?: number[];
  readonly creditAmount?: number[];

  readonly totalSupply: number;
  readonly pricePerToken: number;
  readonly publicPercentage: number;
}

const scenarios = [{
  totalDeposit: [7, 7],
  totalPaid: [5, 5],
  refundedAmount: [2, 2],
  tokenOwned: [5, 5],

  totalSupply: 10,
  pricePerToken: MIN_IOTA_AMOUNT,
  publicPercentage: 100
},
{
  totalDeposit: [5, 5],
  totalPaid: [5, 5],
  refundedAmount: [0, 0],
  tokenOwned: [5, 5],

  totalSupply: 10,
  pricePerToken: MIN_IOTA_AMOUNT,
  publicPercentage: 100
},
{
  totalDeposit: [15],
  totalPaid: [10],
  refundedAmount: [5],
  tokenOwned: [10],

  totalSupply: 10,
  pricePerToken: MIN_IOTA_AMOUNT,
  publicPercentage: 100
}]

const submitTokenOrderFunc = async <T>(spy: string, address: string, params: T) => {
  mockWalletReturnValue(spy, address, params);
  const order = await testEnv.wrap(orderToken)({});
  expect(order?.createdOn).toBeDefined();
  return order;
}

const dummyToken = (totalSupply: number, space: Space, pricePerToken: number, publicPercentageSale: number, guardian: string) => ({
  symbol: 'SOON',
  totalSupply,
  updatedOn: serverTime(),
  createdOn: serverTime(),
  space: space.uid,
  uid: wallet.getRandomEthAddress(),
  pricePerToken,
  allocations: [
    { title: 'Public sale', isPublicSale: true, percentage: publicPercentageSale },
  ],
  createdBy: guardian,
  name: 'MyToken',
  saleLength: 86400000 * 2,
  saleStartDate: dateToTimestamp(dayjs().subtract(1, 'd').toDate()),
  links: [],
  status: TokenStatus.AVAILABLE,
  totalDeposit: 0,
  totalAirdropped: 0,
  autoProcessAt100Percent: true
})


describe('Token trigger test', () => {
  let guardian: string;
  let space: Space;
  let token: any;
  let members: string[]

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardian = await createMember(walletSpy)
    space = await createSpace(walletSpy, guardian)
    const maxMembers = scenarios.reduce((max, scenario) => Math.max(max, scenario.totalDeposit.length), 0)
    const memberPromises = Array.from(Array(maxMembers)).map(() => createMember(walletSpy))
    members = await Promise.all(memberPromises)
  })

  it.each(scenarios)('Should buy tokens with auto trigger', async (input: Inputs) => {
    token = dummyToken(input.totalSupply, space, input.pricePerToken, input.publicPercentage, guardian)
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).create(token)

    const orderPromises = input.totalDeposit.map(async (_, i) => {
      const order = await submitTokenOrderFunc(walletSpy, members[i], { token: token.uid });
      const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, Number(bigDecimal.multiply(input.totalDeposit[i], MIN_IOTA_AMOUNT)));
      await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
      return <Transaction>order
    })

    const orders = await Promise.all(orderPromises)

    await tokenProcessed(token.uid, input.totalDeposit.length, true)

    const tokenData = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data()
    expect(tokenData.tokensOrdered).toBe(input.totalDeposit.reduce((sum, act) => sum + act * MIN_IOTA_AMOUNT / tokenData.pricePerToken, 0))

    for (let i = 0; i < input.totalDeposit.length; ++i) {
      const member = members[i]
      const distribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`).get()).data()
      const refundedAmount = Number(bigDecimal.multiply(input.refundedAmount[i], MIN_IOTA_AMOUNT))
      expect(distribution.totalDeposit).toBe(Number(bigDecimal.multiply(input.totalDeposit[i], MIN_IOTA_AMOUNT)))
      expect(distribution.totalPaid).toBe(Number(bigDecimal.multiply(input.totalPaid[i], MIN_IOTA_AMOUNT)))
      expect(distribution.refundedAmount).toBe(refundedAmount)
      expect(distribution.totalBought).toBe(input.tokenOwned[i])
      expect(distribution.tokenOwned).toBe(input.tokenOwned[i])
      if (distribution.totalPaid) {
        expect(distribution.billPaymentId).toBeDefined()
      }
      if (distribution.billPaymentId) {
        const paymentDoc = await admin.firestore().doc(`${COL.TRANSACTION}/${distribution.billPaymentId}`).get()
        expect(paymentDoc.exists).toBe(true)
        const paidAmount = isEmpty(input.paymentAmount) ? input.totalPaid[i] : input.paymentAmount![i];
        expect(paymentDoc.data()?.payload?.amount).toBe(Number(bigDecimal.multiply(paidAmount, MIN_IOTA_AMOUNT)))
        expect(paymentDoc.data()?.payload?.sourceAddress).toBe(orders[i].payload?.targetAddress)
        expect(paymentDoc.data()?.payload?.targetAddress).toBe(getAddress(space.validatedAddress, Network.IOTA))
      }
      if (distribution.creditPaymentId) {
        const creditPaymentDoc = await admin.firestore().doc(`${COL.TRANSACTION}/${distribution.creditPaymentId}`).get()
        expect(creditPaymentDoc.exists).toBe(true)
        const creditAmount = isEmpty(input.creditAmount) ? input.refundedAmount[i] : input.creditAmount![i]
        expect(creditPaymentDoc.data()?.payload?.amount).toBe(Number(bigDecimal.multiply(creditAmount, MIN_IOTA_AMOUNT)))
        const memberAddress = (await admin.firestore().doc(`${COL.MEMBER}/${member}`).get()).data()?.validatedAddress
        expect(creditPaymentDoc.data()?.payload?.sourceAddress).toBe(orders[i].payload?.targetAddress)
        expect(creditPaymentDoc.data()?.payload?.targetAddress).toBe(getAddress(memberAddress, Network.IOTA))
      }
    }
  })

  it('Should should create two and credit third', async () => {
    members.push(await createMember(walletSpy))
    token = dummyToken(10, space, MIN_IOTA_AMOUNT, 100, guardian)
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).create(token)

    const orderPromises = members.map(() => 7).map(async (totalDeposit, i) => {
      const order = await submitTokenOrderFunc(walletSpy, members[i], { token: token.uid });
      const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, Number(bigDecimal.multiply(totalDeposit, MIN_IOTA_AMOUNT)));
      await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
      return <Transaction>order
    })

    await Promise.all(orderPromises)
    await tokenProcessed(token.uid, 2, true)

    const tokenData = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data()
    expect(tokenData.tokensOrdered).toBe(14)

    const distributions = (await admin.firestore().collection(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}`).get())
      .docs.map(d => <TokenDistribution>d.data())
    expect(distributions.length).toBe(2)
    distributions.forEach(d => {
      expect(d.totalDeposit).toBe(7 * MIN_IOTA_AMOUNT)
      expect(d.totalPaid).toBe(5 * MIN_IOTA_AMOUNT)
      expect(d.refundedAmount).toBe(2 * MIN_IOTA_AMOUNT)
      expect(d.tokenOwned).toBe(5)
    })

    const credit = (await admin.firestore().collection(COL.TRANSACTION)
      .where('member', 'in', members)
      .where('type', '==', TransactionType.CREDIT)
      .where('payload.amount', '==', 7 * MIN_IOTA_AMOUNT)
      .get()).docs.map(d => <Transaction>d.data())
    expect(credit.length).toBe(1)
  })

})
