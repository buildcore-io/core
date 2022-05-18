import dayjs from "dayjs";
import bigDecimal from 'js-big-decimal';
import { MIN_IOTA_AMOUNT } from "../../interfaces/config";
import { Space, Transaction } from "../../interfaces/models";
import { COL, SUB_COL } from "../../interfaces/models/base";
import { TokenDistribution, TokenStatus } from "../../interfaces/models/token";
import admin from '../../src/admin.config';
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

// https://docs.google.com/spreadsheets/d/1Oc3VxvXd4Urop5kVV_OB3r-SjZJvEFnOFoHTlGpTOyE/edit#gid=1206378569

const mainPage = ({
  totalDeposit: [1000000, 500000, 20000, 2500000, 4200, 38000, 5000000, 60, 542000, 789322, 733758, 678194, 622631, 567067, 511503, 455940, 400376, 344812, 289249, 233685],
  totalPaid: [656565, 328282, 13131, 1641412, 2757, 24949, 3282823, 39, 355858, 518241, 481760, 445279, 408798, 372317, 335834, 299353, 262872, 226391, 189910, 153429],
  refundedAmount: [343435, 171718, 6869, 858588, 1443, 13051, 1717177, 21, 186142, 271081, 251998, 232915, 213833, 194750, 175669, 156587, 137504, 118421, 99339, 80256],
  tokenOwned: [656565, 328282, 13131, 1641412, 2757, 24949, 3282823, 39, 355858, 518241, 481760, 445279, 408798, 372317, 335834, 299353, 262872, 226391, 189910, 153429],

  totalSupply: 100000000,
  pricePerToken: MIN_IOTA_AMOUNT,
  publicPercentage: 10
})

const scenario1 = ({
  totalDeposit: [1000, 500000, 20, 250000, 4200, 38000, 1000000, 60, 542000, 7891, 7338, 67894, 6230, 5667, 5103, 455939, 400376, 342, 248, 233685],
  totalPaid: [999.999975, 499999.99995, 19.99995, 249999.999975, 4200, 37999.99995, 999999.999975, 60, 541999.99995, 7890.999975, 7338, 67893.999975, 6229.99995, 5667, 5103, 455938.99995, 400375.99995, 342, 247.99995, 233685],
  refundedAmount: [0.000025, 0.00005, 0.00005, 0.000025, 0, 0.00005, 0.000025, 0, 0.00005, 0.000025, 0, 0.000025, 0.00005, 0, 0, 0.00005, 0.00005, 0, 0.00005, 0],
  tokenOwned: [13333333, 6666666666, 266666, 3333333333, 56000000, 506666666, 13333333333, 800000, 7226666666, 105213333, 97840000, 905253333, 83066666, 75560000, 68040000, 6079186666, 5338346666, 4560000, 3306666, 3115800000],

  totalSupply: 50000000000000,
  pricePerToken: 75,
  publicPercentage: 12.5
})

const scenario2 = ({
  totalDeposit: [250000, 50, 200, 2500, 4200, 380, 50, 60, 542, 781, 7338, 67894, 630, 5677, 5103, 4559, 476, 32, 2898, 2335],
  totalPaid: [175707.397985, 35.141475, 140.565915, 1757.07398, 2951.88429, 267.07524, 35.141475, 42.169775, 380.933635, 548.909915, 5157.36355, 47717.912315, 442.782645, 3989.963595, 3586.53941, 3204.20011, 334.546885, 22.490545, 2036.80016, 1641.1071],
  refundedAmount: [74292.602015, 14.858525, 59.434085, 742.92602, 1248.11571, 112.92476, 14.858525, 17.830225, 161.066365, 232.090085, 2180.63645, 20176.087685, 187.217355, 1687.036405, 1516.46059, 1354.79989, 141.453115, 9.509455, 861.19984, 693.8929],
  tokenOwned: [35141479597, 7028295, 28113183, 351414796, 590376858, 53415048, 7028295, 8433955, 76186727, 109781983, 1031472710, 9543582463, 88556529, 797992719, 717307882, 640840022, 66909377, 4498109, 407360032, 328221420],

  totalSupply: 100000000000,
  pricePerToken: 5,
  publicPercentage: 50
})

const scenario3 = ({
  totalDeposit: [100000, 256651, 200, 25, 4200, 38000, 500000, 60, 542000, 789321, 733758, 678194, 622630, 567067, 511503, 455939, 400376, 344812, 289248, 233685],
  totalPaid: [99999.9999, 256650.9999, 199.9998, 24.9999, 4200, 37999.9998, 499999.9998, 60, 541999.9998, 789321, 733758, 678193.9998, 622629.9999, 567066.9999, 511503, 455938.9998, 400375.9998, 344811.9999, 289248, 233685],
  refundedAmount: [0.0001, 0.0001, 0.0002, 0.0001, 0, 0.0002, 0.0002, 0, 0.0002, 0, 0, 0.0002, 0.0001, 0.0001, 0, 0.0002, 0.0002, 0.0001, 0, 0],
  tokenOwned: [333333333, 855503333, 666666, 83333, 14000000, 126666666, 1666666666, 200000, 1806666666, 2631070000, 2445860000, 2260646666, 2075433333, 1890223333, 1705010000, 1519796666, 1334586666, 1149373333, 964160000, 778950000],

  totalSupply: 250000000000,
  pricePerToken: 300,
  publicPercentage: 10
})

const scenario4 = ({
  totalDeposit: [10, 5, 20, 25, 42, 38, 500, 60, 542, 7893, 73, 6, 6226, 5, 511, 4559, 400, 344, 28, 235],
  totalPaid: [0, 0, 15, 15, 30, 30, 495, 60, 540, 7890, 60, 0, 6225, 0, 510, 4545, 390, 330, 15, 225],
  refundedAmount: [10, 5, 5, 10, 12, 8, 5, 0, 2, 3, 13, 6, 1, 5, 1, 14, 10, 14, 13, 10],
  tokenOwned: [0, 0, 1, 1, 2, 2, 33, 4, 36, 526, 4, 0, 415, 0, 34, 303, 26, 22, 1, 15],

  totalSupply: 1000000,
  pricePerToken: 15 * MIN_IOTA_AMOUNT,
  publicPercentage: 10
})

const scenario5 = ({
  totalDeposit: [1500000, 500000, 20000, 2500000, 420000, 38000, 50000, 60, 542000, 789321, 733758, 6781094, 622630, 56707, 5103, 455939, 476, 344812, 2892448, 23368450],
  totalPaid: [1500000, 500000, 20000, 2500000, 420000, 38000, 50000, 60, 542000, 789321, 733758, 6781094, 622630, 56707, 5103, 455939, 476, 344812, 2892448, 23368450],
  refundedAmount: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  tokenOwned: [1500000, 500000, 20000, 2500000, 420000, 38000, 50000, 60, 542000, 789321, 733758, 6781094, 622630, 56707, 5103, 455939, 476, 344812, 2892448, 23368450],

  totalSupply: 5000000000000000,
  pricePerToken: MIN_IOTA_AMOUNT,
  publicPercentage: 50
})

const scenario6 = ({
  totalDeposit: [5, 7, 9, 3].map(a => a / MIN_IOTA_AMOUNT),
  totalPaid: [4, 6, 8, 2].map(a => a / MIN_IOTA_AMOUNT),
  refundedAmount: [1, 1, 1, 1].map(a => a / MIN_IOTA_AMOUNT),
  tokenOwned: [2, 3, 4, 1],

  totalSupply: 10,
  pricePerToken: 2.1,
  publicPercentage: 100
})

const custom = ({
  totalDeposit: [4, 8, 2],
  totalPaid: [3, 6, 1],
  refundedAmount: [1, 2, 1],
  tokenOwned: [3, 6, 1],

  totalSupply: 10,
  pricePerToken: MIN_IOTA_AMOUNT,
  publicPercentage: 100
})

const scenarios = [mainPage, scenario1, scenario2, scenario3, scenario4, scenario5, scenario6, custom]

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


  it.each(scenarios)('Should buy tokens', async (input: Inputs) => {
    token = dummyToken(input.totalSupply, space, input.pricePerToken, input.publicPercentage, guardian)
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).create(token)

    const memberPromises = Array.from(Array(input.totalDeposit.length)).map(() => createMember(walletSpy, true))
    const members = await Promise.all(memberPromises)

    const orderPromises = Array.from(Array(input.totalDeposit.length)).map(async (_, i) => {
      const order = await submitTokenOrderFunc(walletSpy, members[i], { token: token.uid });
      const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, Number(bigDecimal.multiply(input.totalDeposit[i], MIN_IOTA_AMOUNT)));
      await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
      return <Transaction>order
    })

    const orders = await Promise.all(orderPromises)
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ status: TokenStatus.PROCESSING });
    await tokenProcessed(token.uid, input.totalDeposit.length, true)

    for (let i = 0; i < members.length; ++i) {
      const member = members[i]
      const distribution = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`).get()).data()
      const refundedAmount = Number(bigDecimal.multiply(input.refundedAmount[i], MIN_IOTA_AMOUNT))
      expect(distribution.totalDeposit).toBe(Number(bigDecimal.multiply(input.totalDeposit[i], MIN_IOTA_AMOUNT)))
      expect(distribution.totalPaid).toBe(Number(bigDecimal.multiply(input.totalPaid[i], MIN_IOTA_AMOUNT)))
      expect(distribution.refundedAmount).toBe(refundedAmount)
      expect(distribution.totalBought).toBe(input.tokenOwned[i])
      expect(distribution.tokenOwned).toBe(input.tokenOwned[i])
      const paymentDoc = await admin.firestore().doc(`${COL.TRANSACTION}/${distribution.billPaymentId}`).get()
      expect(paymentDoc.exists).toBe(true)
      expect(paymentDoc.data()?.payload?.amount).toBe(Number(bigDecimal.multiply(input.totalPaid[i], MIN_IOTA_AMOUNT)))
      expect(paymentDoc.data()?.payload?.sourceAddress).toBe(orders[i].payload?.targetAddress)
      expect(paymentDoc.data()?.payload?.targetAddress).toBe(space.validatedAddress)
      if (refundedAmount) {
        const creditPaymentDoc = await admin.firestore().doc(`${COL.TRANSACTION}/${distribution.creditPaymentId}`).get()
        expect(creditPaymentDoc.exists).toBe(true)
        const memberAddress = (await admin.firestore().doc(`${COL.MEMBER}/${member}`).get()).data()?.validatedAddress
        expect(creditPaymentDoc.data()?.payload?.sourceAddress).toBe(orders[i].payload?.targetAddress)
        expect(creditPaymentDoc.data()?.payload?.targetAddress).toBe(memberAddress)
      }
    }
  })
})

