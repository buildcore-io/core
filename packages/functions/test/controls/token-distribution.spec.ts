import {
  BillPaymentType,
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  SUB_COL,
  SYSTEM_CONFIG_DOC_ID,
  TokenDistribution,
  TokenStatus,
  TOKEN_SALE_TEST,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import bigDecimal from 'js-big-decimal';
import { isEmpty } from 'lodash';
import admin from '../../src/admin.config';
import { orderToken } from '../../src/runtime/firebase/token/base';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp, serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import {
  createMember,
  createRoyaltySpaces,
  createSpace,
  getRandomSymbol,
  milestoneProcessed,
  mockWalletReturnValue,
  submitMilestoneFunc,
  tokenProcessed,
} from './common';

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

// https://docs.google.com/spreadsheets/d/1Oc3VxvXd4Urop5kVV_OB3r-SjZJvEFnOFoHTlGpTOyE/edit#gid=1206378569

const mainPage = {
  totalDeposit: [
    1000000, 500000, 20000, 2500000, 4200, 38000, 5000000, 60, 542000, 789322, 733758, 678194,
    622631, 567067, 511503, 455940, 400376, 344812, 289249, 233685,
  ],
  totalPaid: [
    656565, 328282, 13131, 1641412, 2757, 24949, 3282823, 39, 355858, 518241, 481760, 445279,
    408798, 372317, 335834, 299353, 262872, 226391, 189910, 153429,
  ],
  refundedAmount: [
    343435, 171718, 6869, 858588, 1443, 13051, 1717177, 21, 186142, 271081, 251998, 232915, 213833,
    194750, 175669, 156587, 137504, 118421, 99339, 80256,
  ],
  tokenOwned: [
    656565, 328282, 13131, 1641412, 2757, 24949, 3282823, 39, 355858, 518241, 481760, 445279,
    408798, 372317, 335834, 299353, 262872, 226391, 189910, 153429,
  ],

  paymentAmount: [
    640150.875, 320074.95, 12802.725, 1600376.7, 2688.075, 24325.275, 3200752.425, 39, 346961.55,
    505284.975, 469716, 434147.025, 398578.05, 363009.075, 327438.15, 291869.175, 256300.2,
    220731.225, 185162.25, 149593.275,
  ],

  totalSupply: 100000000,
  pricePerToken: MIN_IOTA_AMOUNT,
  publicPercentage: 10,
};

const scenario1 = {
  totalDeposit: [
    1000, 500000, 20, 250000, 4200, 38000, 1000000, 60, 542000, 7891, 7338, 67894, 6230, 5667, 5103,
    455939, 400376, 342, 248, 233685,
  ],
  totalPaid: [
    999.999975, 499999.99995, 19.99995, 249999.999975, 4200, 37999.99995, 999999.999975, 60,
    541999.99995, 7890.999975, 7338, 67893.999975, 6229.99995, 5667, 5103, 455938.99995,
    400375.99995, 342, 247.99995, 233685,
  ],
  refundedAmount: [
    0.000025, 0.00005, 0.00005, 0.000025, 0, 0.00005, 0.000025, 0, 0.00005, 0.000025, 0, 0.000025,
    0.00005, 0, 0, 0.00005, 0.00005, 0, 0.00005, 0,
  ],
  tokenOwned: [
    13333333, 6666666666, 266666, 3333333333, 56000000, 506666666, 13333333333, 800000, 7226666666,
    105213333, 97840000, 905253333, 83066666, 75560000, 68040000, 6079186666, 5338346666, 4560000,
    3306666, 3115800000,
  ],

  paymentAmount: [
    975, 487500, 20, 243750, 4095, 37050, 975000, 58.5, 528450, 7693.725, 7154.55, 66196.65,
    6074.25, 5525.325, 4975.425, 444540.525, 390366.6, 333.45, 241.8, 227842.875,
  ],

  totalSupply: 50000000000000,
  pricePerToken: 75,
  publicPercentage: 12.5,
};

const scenario2 = {
  totalDeposit: [
    250000, 50, 200, 2500, 4200, 380, 50, 60, 542, 781, 7338, 67894, 630, 5677, 5103, 4559, 476, 32,
    2898, 2335,
  ],
  totalPaid: [
    175707.397985, 35.141475, 140.565915, 1757.07398, 2951.88429, 267.07524, 35.141475, 42.169775,
    380.933635, 548.909915, 5157.36355, 47717.912315, 442.782645, 3989.963595, 3586.53941,
    3204.20011, 334.546885, 22.490545, 2036.80016, 1641.1071,
  ],
  refundedAmount: [
    74292.602015, 14.858525, 59.434085, 742.92602, 1248.11571, 112.92476, 14.858525, 17.830225,
    161.066365, 232.090085, 2180.63645, 20176.087685, 187.217355, 1687.036405, 1516.46059,
    1354.79989, 141.453115, 9.509455, 861.19984, 693.8929,
  ],
  tokenOwned: [
    35141479597, 7028295, 28113183, 351414796, 590376858, 53415048, 7028295, 8433955, 76186727,
    109781983, 1031472710, 9543582463, 88556529, 797992719, 717307882, 640840022, 66909377, 4498109,
    407360032, 328221420,
  ],

  paymentAmount: [
    171314.713036, 35.141475, 137.051768, 1713.147131, 2878.087183, 260.398359, 35.141475,
    41.115531, 371.410295, 535.187168, 5028.429462, 46524.964508, 431.713079, 3890.214506,
    3496.875925, 3124.095108, 326.183213, 22.490545, 1985.880156, 1600.079423,
  ],

  totalSupply: 100000000000,
  pricePerToken: 5,
  publicPercentage: 50,
};

const scenario3 = {
  totalDeposit: [
    100000, 256651, 200, 25, 4200, 38000, 500000, 60, 542000, 789321, 733758, 678194, 622630,
    567067, 511503, 455939, 400376, 344812, 289248, 233685,
  ],
  totalPaid: [
    99999.9999, 256650.9999, 199.9998, 24.9999, 4200, 37999.9998, 499999.9998, 60, 541999.9998,
    789321, 733758, 678193.9998, 622629.9999, 567066.9999, 511503, 455938.9998, 400375.9998,
    344811.9999, 289248, 233685,
  ],
  refundedAmount: [
    0.0001, 0.0001, 0.0002, 0.0001, 0, 0.0002, 0.0002, 0, 0.0002, 0, 0, 0.0002, 0.0001, 0.0001, 0,
    0.0002, 0.0002, 0.0001, 0, 0,
  ],
  tokenOwned: [
    333333333, 855503333, 666666, 83333, 14000000, 126666666, 1666666666, 200000, 1806666666,
    2631070000, 2445860000, 2260646666, 2075433333, 1890223333, 1705010000, 1519796666, 1334586666,
    1149373333, 964160000, 778950000,
  ],

  paymentAmount: [
    97500, 250234.725, 195, 25, 4095, 37050, 487500, 58.5, 528450, 769587.975, 715414.05, 661239.15,
    607064.25, 552890.325, 498715.425, 444540.525, 390366.6, 336191.7, 282016.8, 227842.875,
  ],

  totalSupply: 250000000000,
  pricePerToken: 300,
  publicPercentage: 10,
};

const scenario4 = {
  totalDeposit: [
    10, 5, 20, 25, 42, 38, 500, 60, 542, 7893, 73, 6, 6226, 5, 511, 4559, 400, 344, 28, 235,
  ],
  totalPaid: [
    0, 0, 15, 15, 30, 30, 495, 60, 540, 7890, 60, 0, 6225, 0, 510, 4545, 390, 330, 15, 225,
  ],
  refundedAmount: [10, 5, 5, 10, 12, 8, 5, 0, 2, 3, 13, 6, 1, 5, 1, 14, 10, 14, 13, 10],
  tokenOwned: [0, 0, 1, 1, 2, 2, 33, 4, 36, 526, 4, 0, 415, 0, 34, 303, 26, 22, 1, 15],

  paymentAmount: [
    0, 0, 15, 15, 30, 30, 482.625, 58.5, 526.5, 7692.75, 58.5, 0, 6069.375, 0, 497.25, 4431.375,
    380.25, 321.75, 15, 219.375,
  ],

  totalSupply: 1000000,
  pricePerToken: 15 * MIN_IOTA_AMOUNT,
  publicPercentage: 10,
};

const scenario5 = {
  totalDeposit: [
    1500000, 500000, 20000, 2500000, 420000, 38000, 50000, 60, 542000, 789321, 733758, 6781094,
    622630, 56707, 5103, 455939, 476, 344812, 2892448, 23368450,
  ],
  totalPaid: [
    1500000, 500000, 20000, 2500000, 420000, 38000, 50000, 60, 542000, 789321, 733758, 6781094,
    622630, 56707, 5103, 455939, 476, 344812, 2892448, 23368450,
  ],
  refundedAmount: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  tokenOwned: [
    1500000, 500000, 20000, 2500000, 420000, 38000, 50000, 60, 542000, 789321, 733758, 6781094,
    622630, 56707, 5103, 455939, 476, 344812, 2892448, 23368450,
  ],

  paymentAmount: [
    1462500, 487500, 19500, 2437500, 409500, 37050, 48750, 58.5, 528450, 769587.975, 715414.05,
    6611566.65, 607064.25, 55289.325, 4975.425, 444540.525, 464.1, 336191.7, 2820136.8, 22784238.75,
  ],

  totalSupply: 5000000000000000,
  pricePerToken: MIN_IOTA_AMOUNT,
  publicPercentage: 50,
};

//No decimal test
const scenario6 = {
  totalDeposit: [5, 7, 9, 3],
  totalPaid: [4.0000002, 6.0000003, 8.0000004, 2.0000001],
  refundedAmount: [0.9999998, 0.9999997, 0.9999996, 0.9999999],
  tokenOwned: [2, 3, 4, 1],

  paymentAmount: [4, 6, 8, 2],
  creditAmount: [1, 1, 1, 1],

  totalSupply: 10,
  pricePerToken: 2 * MIN_IOTA_AMOUNT + 0.1,
  publicPercentage: 100,
};

//No decimal after leftover test
const scenario7 = {
  totalDeposit: [20, 12],
  totalPaid: [14.0000007, 6.0000003],
  refundedAmount: [5.9999993, 5.9999997],
  tokenOwned: [7, 3],
  paymentAmount: [14, 6],
  creditAmount: [6, 6],
  totalSupply: 10,
  pricePerToken: 2 * MIN_IOTA_AMOUNT + 0.1,
  publicPercentage: 100,
};

//No decimal no credit
const scenario8 = {
  totalDeposit: [1.5],
  totalPaid: [1],
  refundedAmount: [0.5],
  tokenOwned: [1],

  paymentAmount: [1.5],

  totalSupply: 1,
  pricePerToken: 1 * MIN_IOTA_AMOUNT,
  publicPercentage: 100,
};

// Total paid is less then MIN_IOTA_AMOUNT
const scenario9 = {
  totalDeposit: [20, 1],
  totalPaid: [10, 0],
  refundedAmount: [10, 1],
  tokenOwned: [10, 0],

  totalSupply: 10,
  pricePerToken: 1 * MIN_IOTA_AMOUNT,
  publicPercentage: 100,
};

const custom = {
  totalDeposit: [4, 8, 2],
  totalPaid: [3, 6, 1],
  refundedAmount: [1, 2, 1],
  tokenOwned: [3, 6, 1],

  totalSupply: 10,
  pricePerToken: MIN_IOTA_AMOUNT,
  publicPercentage: 100,
};

const scenarios = [
  mainPage,
  scenario1,
  scenario2,
  scenario3,
  scenario4,
  scenario5,
  scenario6,
  scenario7,
  scenario8,
  scenario9,
  custom,
];

const submitTokenOrderFunc = async <T>(spy: string, address: string, params: T) => {
  mockWalletReturnValue(spy, address, params);
  const order = await testEnv.wrap(orderToken)({});
  expect(order?.createdOn).toBeDefined();
  return order;
};

const dummyToken = (
  totalSupply: number,
  space: Space,
  pricePerToken: number,
  publicPercentageSale: number,
  guardian: string,
) => ({
  symbol: getRandomSymbol(),
  totalSupply,
  updatedOn: serverTime(),
  createdOn: serverTime(),
  space: space.uid,
  uid: wallet.getRandomEthAddress(),
  pricePerToken,
  allocations: [{ title: 'Public sale', isPublicSale: true, percentage: publicPercentageSale }],
  createdBy: guardian,
  name: 'MyToken',
  saleLength: 86400000 * 2,
  saleStartDate: dateToTimestamp(dayjs().subtract(1, 'd').toDate()),
  links: [],
  status: TokenStatus.AVAILABLE,
  totalDeposit: 0,
  totalAirdropped: 0,
});

describe('Token trigger test', () => {
  let guardian: string;
  let space: Space;
  let token: any;
  let members: string[];

  beforeAll(async () => {
    await createRoyaltySpaces();
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardian = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);
    const maxMembers = scenarios.reduce(
      (max, scenario) => Math.max(max, scenario.totalDeposit.length),
      0,
    );
    const memberPromises = Array.from(Array(maxMembers)).map(() => createMember(walletSpy));
    members = await Promise.all(memberPromises);
  });

  beforeEach(async () => {
    await admin
      .firestore()
      .doc(`${COL.SYSTEM}/${SYSTEM_CONFIG_DOC_ID}`)
      .set({ tokenPurchaseFeePercentage: admin.firestore.FieldValue.delete() }, { merge: true });
  });

  it.each(scenarios)('Should buy tokens', async (input: Inputs) => {
    token = dummyToken(
      input.totalSupply,
      space,
      input.pricePerToken,
      input.publicPercentage,
      guardian,
    );
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).create(token);

    const orderPromises = Array.from(Array(input.totalDeposit.length)).map(async (_, i) => {
      const order = await submitTokenOrderFunc(walletSpy, members[i], { token: token.uid });
      const nextMilestone = await submitMilestoneFunc(
        order.payload.targetAddress,
        Number(bigDecimal.multiply(input.totalDeposit[i], MIN_IOTA_AMOUNT)),
      );
      await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
      return <Transaction>order;
    });

    const orders = await Promise.all(orderPromises);
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ status: TokenStatus.PROCESSING });
    await tokenProcessed(token.uid, input.totalDeposit.length, true);

    for (let i = 0; i < input.totalDeposit.length; ++i) {
      const member = members[i];
      const distribution = <TokenDistribution>(
        (
          await admin
            .firestore()
            .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`)
            .get()
        ).data()
      );
      const refundedAmount = Number(bigDecimal.multiply(input.refundedAmount[i], MIN_IOTA_AMOUNT));
      expect(distribution.totalDeposit).toBe(
        Number(bigDecimal.multiply(input.totalDeposit[i], MIN_IOTA_AMOUNT)),
      );
      expect(distribution.totalPaid).toBe(
        Number(bigDecimal.multiply(input.totalPaid[i], MIN_IOTA_AMOUNT)),
      );
      expect(distribution.refundedAmount).toBe(refundedAmount);
      expect(distribution.totalBought).toBe(input.tokenOwned[i]);
      expect(distribution.tokenOwned).toBe(input.tokenOwned[i]);
      if (distribution.totalPaid) {
        expect(distribution.billPaymentId).toBeDefined();
      }

      if (distribution.billPaymentId) {
        const paymentDoc = await admin
          .firestore()
          .doc(`${COL.TRANSACTION}/${distribution.billPaymentId}`)
          .get();
        expect(paymentDoc.exists).toBe(true);
        const paidAmount = isEmpty(input.paymentAmount)
          ? input.totalPaid[i]
          : input.paymentAmount![i];
        expect(paymentDoc.data()?.payload?.amount).toBe(
          Number(bigDecimal.multiply(paidAmount, MIN_IOTA_AMOUNT)),
        );
        expect(paymentDoc.data()?.payload?.sourceAddress).toBe(orders[i].payload?.targetAddress);
        expect(paymentDoc.data()?.payload?.targetAddress).toBe(getAddress(space, Network.IOTA));
        expect(paymentDoc.data()?.payload?.token).toBe(token.uid);
        expect(paymentDoc.data()?.payload?.tokenSymbol).toBe(token.symbol);
        expect(paymentDoc.data()?.payload?.type).toBe(BillPaymentType.TOKEN_PURCHASE);
      }

      const totalPaid =
        (input.totalPaid[i] + (input.refundedAmount[i] < 1 ? input.refundedAmount[i] : 0)) *
        MIN_IOTA_AMOUNT;
      const supposedRoyaltyAmount = (totalPaid * TOKEN_SALE_TEST.percentage) / 100;
      if (supposedRoyaltyAmount < MIN_IOTA_AMOUNT) {
        expect(distribution.royaltyBillPaymentId).toBe('');
      } else {
        const royaltySpace = <Space>(
          (await admin.firestore().doc(`${COL.SPACE}/${TOKEN_SALE_TEST.spaceone}`).get()).data()
        );
        const royaltyPayment = <Transaction>(
          (
            await admin
              .firestore()
              .doc(`${COL.TRANSACTION}/${distribution.royaltyBillPaymentId}`)
              .get()
          ).data()
        );
        expect(royaltyPayment.payload.amount).toBe(Math.floor(supposedRoyaltyAmount));
        expect(royaltyPayment.payload.targetAddress).toBe(
          getAddress(royaltySpace, royaltyPayment.network!),
        );
      }

      if (distribution.creditPaymentId) {
        const creditPaymentDoc = await admin
          .firestore()
          .doc(`${COL.TRANSACTION}/${distribution.creditPaymentId}`)
          .get();
        expect(creditPaymentDoc.exists).toBe(true);
        const creditAmount = isEmpty(input.creditAmount)
          ? input.refundedAmount[i]
          : input.creditAmount![i];
        expect(creditPaymentDoc.data()?.payload?.amount).toBe(
          Number(bigDecimal.multiply(creditAmount, MIN_IOTA_AMOUNT)),
        );
        const memberData = <Member>(
          (await admin.firestore().doc(`${COL.MEMBER}/${member}`).get()).data()
        );
        expect(creditPaymentDoc.data()?.payload?.sourceAddress).toBe(
          orders[i].payload?.targetAddress,
        );
        expect(creditPaymentDoc.data()?.payload?.targetAddress).toBe(
          getAddress(memberData, Network.IOTA),
        );
      }
    }
  });

  it('Should refund everyone if public sale is set to zero', async () => {
    token = dummyToken(100, space, MIN_IOTA_AMOUNT, 10, guardian);
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).create(token);

    const totalDeposits = [2, 3];

    const orderPromises = totalDeposits.map(async (totalDeposit, i) => {
      const order = await submitTokenOrderFunc(walletSpy, members[i], { token: token.uid });
      const nextMilestone = await submitMilestoneFunc(
        order.payload.targetAddress,
        Number(bigDecimal.multiply(totalDeposit, MIN_IOTA_AMOUNT)),
      );
      await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
      return <Transaction>order;
    });

    await Promise.all(orderPromises);
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({
        status: TokenStatus.PROCESSING,
        allocations: [{ title: 'Public sale', isPublicSale: true, percentage: 0 }],
      });
    await tokenProcessed(token.uid, totalDeposits.length, true);

    for (let i = 0; i < totalDeposits.length; ++i) {
      const member = members[i];
      const distribution = <TokenDistribution>(
        (
          await admin
            .firestore()
            .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`)
            .get()
        ).data()
      );
      const refundedAmount = Number(bigDecimal.multiply(totalDeposits[i], MIN_IOTA_AMOUNT));
      expect(distribution.totalDeposit).toBe(
        Number(bigDecimal.multiply(totalDeposits[i], MIN_IOTA_AMOUNT)),
      );
      expect(distribution.totalPaid).toBe(0);
      expect(distribution.refundedAmount).toBe(refundedAmount);
    }
  });

  it.each([
    { isMember: true, fee: 0 },
    { isMember: true, fee: 1 },
    { isMember: true, fee: 5 },
    { isMember: false, fee: 0 },
    { isMember: false, fee: 1 },
    { isMember: false, fee: 5 },
  ])('Custom fees', async ({ isMember, fee }: { isMember: boolean; fee: number }) => {
    if (isMember) {
      await admin
        .firestore()
        .doc(`${COL.MEMBER}/${members[0]}`)
        .update({ tokenPurchaseFeePercentage: fee });
    } else {
      await admin
        .firestore()
        .doc(`${COL.SYSTEM}/${SYSTEM_CONFIG_DOC_ID}`)
        .set({ tokenPurchaseFeePercentage: fee });
    }

    const totalPaid = 100 * MIN_IOTA_AMOUNT;
    token = dummyToken(100, space, MIN_IOTA_AMOUNT, 100, guardian);
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).create(token);

    const order = await submitTokenOrderFunc(walletSpy, members[0], { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, totalPaid);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ status: TokenStatus.PROCESSING });
    await tokenProcessed(token.uid, 1, true);

    const billPayments = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('member', '==', members[0])
        .where('payload.token', '==', token.uid)
        .get()
    ).docs.map((d) => <Transaction>d.data());

    const billPaymentToSpace = billPayments.find(
      (bp) => bp.payload.amount === totalPaid * (1 - fee / 100),
    );
    expect(billPaymentToSpace).toBeDefined();

    if (fee) {
      const royaltyBillPayment = billPayments.find(
        (bp) => bp.payload.amount === totalPaid * (fee / 100),
      );
      expect(royaltyBillPayment).toBeDefined();
    } else {
      expect(billPayments.filter((bp) => bp.payload.royalty).length).toBe(0);
    }

    await admin
      .firestore()
      .doc(`${COL.MEMBER}/${members[0]}`)
      .set({ tokenPurchaseFeePercentage: admin.firestore.FieldValue.delete() }, { merge: true });
  });
});
