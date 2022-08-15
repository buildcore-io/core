import dayjs from "dayjs";
import { MIN_IOTA_AMOUNT } from "../interfaces/config";
import { WEN_FUNC } from "../interfaces/functions";
import { Space } from "../interfaces/models";
import { COL } from "../interfaces/models/base";
import { Token, TokenStatus } from "../interfaces/models/token";
import admin from '../src/admin.config';
import { creditToken, orderToken } from "../src/controls/token.control";
import { dateToTimestamp, serverTime } from "../src/utils/dateTime.utils";
import * as wallet from '../src/utils/wallet.utils';
import { createMember, createSpace, getRandomSymbol, milestoneProcessed, mockWalletReturnValue, submitMilestoneFunc } from "../test/controls/common";
import { testEnv } from "../test/set-up";

let walletSpy: any;

const submitTokenOrderFunc = async <T>(spy: string, address: string, params: T) => {
  mockWalletReturnValue(spy, address, params);
  const order = await testEnv.wrap(orderToken)({});
  expect(order?.createdOn).toBeDefined();
  return order;
}

describe("Token controller: " + WEN_FUNC.orderToken, () => {
  let memberAddress: string;
  let space: Space;
  let token: Token

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy)
    space = await createSpace(walletSpy, memberAddress)

    const tokenId = wallet.getRandomEthAddress()
    token = ({
      symbol: getRandomSymbol(),
      totalSupply: 1000,
      approved: true,
      rejected: false,
      icon: 'icon',
      overviewGraphics: 'overviewGraphics',
      updatedOn: serverTime(),
      createdOn: serverTime(),
      space: space.uid,
      uid: tokenId,
      pricePerToken: MIN_IOTA_AMOUNT,
      allocations: [
        { title: 'Public sale', isPublicSale: true, percentage: 50 },
        { title: 'Private', percentage: 50 }
      ],
      createdBy: memberAddress,
      name: 'MyToken',
      wenUrl: 'https://wen.soonaverse.com/token/' + tokenId,
      saleLength: 86400000 * 2,
      saleStartDate: dateToTimestamp(dayjs().subtract(1, 'd').toDate()),
      links: [],
      status: TokenStatus.AVAILABLE,
      totalDeposit: 0,
      totalAirdropped: 0,
      termsAndConditions: 'https://wen.soonaverse.com/token/terms-and-conditions',
      access: 0
    })
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  });

  it('Should create order and credit in parallel', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, MIN_IOTA_AMOUNT);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({
      saleStartDate: dateToTimestamp(dayjs().subtract(3, 'd').toDate()),
      coolDownEnd: dateToTimestamp(dayjs().add(1, 'd').toDate())
    });

    const creditTokenOrder = async () => {
      mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, amount: MIN_IOTA_AMOUNT });
      return testEnv.wrap(creditToken)({});
    }

    const promises = [creditTokenOrder(), creditTokenOrder()]
    const result = await Promise.allSettled(promises)
    expect(result.filter(r => r.status === 'rejected').length).toBe(1)
    expect(result.filter(r => r.status === 'fulfilled').length).toBe(1)
  })

})
