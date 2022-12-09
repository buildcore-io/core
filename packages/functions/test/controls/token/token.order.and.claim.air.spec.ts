import {
  COL,
  MIN_IOTA_AMOUNT,
  Space,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenDropStatus,
  TokenStatus,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../../src/admin.config';
import { airdropToken, claimAirdroppedToken } from '../../../src/controls/token-airdrop.control';
import { orderToken } from '../../../src/controls/token.control';
import { dateToTimestamp, serverTime } from '../../../src/utils/dateTime.utils';
import * as wallet from '../../../src/utils/wallet.utils';
import { MEDIA, testEnv } from '../../set-up';
import {
  createMember,
  createSpace,
  getRandomSymbol,
  milestoneProcessed,
  mockWalletReturnValue,
  submitMilestoneFunc,
  tokenProcessed,
  wait,
} from '../common';

let walletSpy: any;

const submitTokenOrderFunc = async <T>(spy: string, address: string, params: T) => {
  mockWalletReturnValue(spy, address, params);
  const order = await testEnv.wrap(orderToken)({});
  expect(order?.createdOn).toBeDefined();
  return order;
};

describe('Order and claim airdropped token test', () => {
  let memberAddress: string;
  let space: Space;
  let token: Token;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy);
    space = await createSpace(walletSpy, memberAddress);

    const tokenId = wallet.getRandomEthAddress();
    token = {
      symbol: getRandomSymbol(),
      totalSupply: 10,
      approved: true,
      rejected: false,
      icon: MEDIA,
      overviewGraphics: MEDIA,
      updatedOn: serverTime(),
      createdOn: serverTime(),
      space: space.uid,
      uid: tokenId,
      pricePerToken: MIN_IOTA_AMOUNT,
      allocations: [
        { title: 'Public sale', isPublicSale: true, percentage: 50 },
        { title: 'Private', percentage: 50 },
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
      access: 0,
    };
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);

    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 5, recipient: memberAddress, vestingAt: dayjs().toDate() }],
    };
    mockWalletReturnValue(walletSpy, memberAddress, airdropRequest);
    await testEnv.wrap(airdropToken)({});
  });

  it('Should order and claim dropped', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(
      order.payload.targetAddress,
      5 * token.pricePerToken,
    );
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid });
    const claimOrder = await testEnv.wrap(claimAirdroppedToken)({});
    const milestone = await submitMilestoneFunc(
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ status: TokenStatus.PROCESSING });
    await tokenProcessed(token.uid, 1, true);

    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.AIRDROP)
        .where('member', '==', memberAddress)
        .where('status', '==', TokenDropStatus.CLAIMED)
        .get();
      return snap.size === 1;
    });

    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`);
    const distribution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(distribution.tokenClaimed).toBe(5);
    expect(distribution.totalPaid).toBe(5 * token.pricePerToken);
    expect(distribution.tokenOwned).toBe(10);
  });
});