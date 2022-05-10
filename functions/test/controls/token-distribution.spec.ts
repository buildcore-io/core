import dayjs from "dayjs";
import * as admin from 'firebase-admin';
import { MIN_IOTA_AMOUNT } from "../../interfaces/config";
import { Space } from "../../interfaces/models";
import { COL, SUB_COL } from "../../interfaces/models/base";
import { TokenDistribution, TokenStatus } from "../../interfaces/models/token";
import { orderToken } from "../../src/controls/token.control";
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

  readonly totalSupply: number;
  readonly pricePerToken: number;
  readonly publicPercentage: number;
}

const inputs: Inputs[] = [{
  totalDeposit: [1000000, 500000, 20000, 2500000, 4200, 38000, 5000000, 60, 542000, 789322, 733758, 678194, 622631, 567067, 511503, 455940, 400376, 344812, 289249, 233685],
  totalPaid: [656565, 328282, 13131, 1641412, 2757, 24949, 3282823, 39, 355858, 518241, 481760, 445279, 408798, 372317, 335834, 299353, 262872, 226391, 189910, 153429],
  refundedAmount: [343435, 171718, 6869, 858588, 1443, 13051, 1717177, 21, 186142, 271081, 251998, 232915, 213833, 194750, 175669, 156587, 137504, 118421, 99339, 80256],
  tokenOwned: [656565, 328282, 13131, 1641412, 2757, 24949, 3282823, 39, 355858, 518241, 481760, 445279, 408798, 372317, 335834, 299353, 262872, 226391, 189910, 153429],

  totalSupply: 100000000,
  pricePerToken: MIN_IOTA_AMOUNT,
  publicPercentage: 10
}, {
  totalDeposit: [4, 8, 2],
  totalPaid: [3, 6, 1],
  refundedAmount: [1, 2, 1],
  tokenOwned: [3, 6, 1],
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
  totalAirdropped: 0
})


describe('Token trigger test', () => {
  let guardian: string;
  let space: Space;
  let token: any;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardian = await createMember(walletSpy)
    space = await createSpace(walletSpy, guardian, true)
  });


  it.each(inputs)('Should buy tokens', async (input: Inputs) => {
    token = dummyToken(input.totalSupply, space, input.pricePerToken, input.publicPercentage, guardian)
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).create(token)

    const memberPromises = Array.from(Array(input.totalDeposit.length)).map(() => createMember(walletSpy, true))
    const members = await Promise.all(memberPromises)

    const orderPromises = Array.from(Array(input.totalDeposit.length)).map(async (_, i) => {
      const order = await submitTokenOrderFunc(walletSpy, members[i], { token: token.uid });
      const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, input.totalDeposit[i] * MIN_IOTA_AMOUNT);
      await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
    })

    await Promise.all(orderPromises)
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ status: TokenStatus.PROCESSING });
    await tokenProcessed(token.uid, input.totalDeposit.length, true)

    for (let i = 0; i < members.length; ++i) {
      const member = members[i]
      const distribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`).get()).data()
      expect(distribution.totalDeposit).toBe(input.totalDeposit[i] * MIN_IOTA_AMOUNT)
      expect(distribution.totalPaid).toBe(input.totalPaid[i] * MIN_IOTA_AMOUNT)
      expect(distribution.refundedAmount).toBe(input.refundedAmount[i] * MIN_IOTA_AMOUNT)
      expect(distribution.totalBought).toBe(input.tokenOwned[i])
      expect(distribution.tokenOwned).toBe(input.tokenOwned[i])
    }

  })
})
