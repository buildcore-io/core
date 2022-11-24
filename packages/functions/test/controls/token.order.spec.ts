import {
  Access,
  COL,
  MIN_IOTA_AMOUNT,
  Space,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStatus,
  WenError,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { joinSpace } from '../../src/controls/space/member.join.control';
import { creditToken, orderToken } from '../../src/controls/token.control';
import { dateToTimestamp, serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { MEDIA, testEnv } from '../set-up';
import {
  createMember,
  createSpace,
  expectThrow,
  getRandomSymbol,
  milestoneProcessed,
  mockIpCheck,
  mockWalletReturnValue,
  submitMilestoneFunc,
} from './common';

let walletSpy: any;

const submitTokenOrderFunc = async <T>(spy: string, address: string, params: T) => {
  mockWalletReturnValue(spy, address, params);
  const order = await testEnv.wrap(orderToken)({});
  expect(order?.createdOn).toBeDefined();
  return order;
};

const submitCreditTokenFunc = async <T>(spy: string, address: string, params: T) => {
  mockWalletReturnValue(spy, address, params);
  const order = await testEnv.wrap(creditToken)({});
  expect(order?.createdOn).toBeDefined();
  return order;
};

const assertOrderedTokensCount = async (tokenId: string, expected: number) => {
  const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).get()).data();
  expect(token.tokensOrdered).toBe(expected);
};

describe('Token controller: ' + WEN_FUNC.orderToken, () => {
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
      totalSupply: 1000,
      approved: true,
      rejected: false,
      icon: MEDIA,
      overviewGraphics: 'overviewGraphics',
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
  });

  it('Should create token order', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(
      order.payload.targetAddress,
      order.payload.amount,
    );
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const distribution = (
      await admin
        .firestore()
        .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
        .get()
    ).data();
    expect(distribution?.totalDeposit).toBe(MIN_IOTA_AMOUNT);
    await assertOrderedTokensCount(token.uid, 1);
  });

  it('Should order more token', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(
      order.payload.targetAddress,
      order.payload.amount,
    );
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const order2 = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone2 = await submitMilestoneFunc(
      order2.payload.targetAddress,
      order2.payload.amount,
    );
    await milestoneProcessed(nextMilestone2.milestone, nextMilestone2.tranId);

    const distribution = (
      await admin
        .firestore()
        .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
        .get()
    ).data();
    expect(distribution?.totalDeposit).toBe(MIN_IOTA_AMOUNT * 2);
    await assertOrderedTokensCount(token.uid, 2);
  });

  it('Should create token order and should credit some amount', async () => {
    for (const _ of [0, 1]) {
      const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
      const nextMilestone = await submitMilestoneFunc(
        order.payload.targetAddress,
        order.payload.amount,
      );
      await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
    }

    const distribution = (
      await admin
        .firestore()
        .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
        .get()
    ).data();
    expect(distribution?.totalDeposit).toBe(MIN_IOTA_AMOUNT * 2);

    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({
        saleStartDate: dateToTimestamp(dayjs().subtract(3, 'd').toDate()),
        coolDownEnd: dateToTimestamp(dayjs().add(1, 'd').toDate()),
      });

    await submitCreditTokenFunc(walletSpy, memberAddress, {
      token: token.uid,
      amount: MIN_IOTA_AMOUNT,
    });

    const updatedDistribution = (
      await admin
        .firestore()
        .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
        .get()
    ).data();
    expect(updatedDistribution?.totalDeposit).toBe(MIN_IOTA_AMOUNT);

    const updatedToken = (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data();
    expect(updatedToken?.totalDeposit).toBe(MIN_IOTA_AMOUNT);

    await assertOrderedTokensCount(token.uid, 1);
  });

  it('Should create token order and should credit all amount', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(
      order.payload.targetAddress,
      order.payload.amount,
    );
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const distribution = (
      await admin
        .firestore()
        .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
        .get()
    ).data();
    expect(distribution?.totalDeposit).toBe(MIN_IOTA_AMOUNT);

    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({
        saleStartDate: dateToTimestamp(dayjs().subtract(3, 'd').toDate()),
        coolDownEnd: dateToTimestamp(dayjs().add(1, 'd').toDate()),
      });

    await submitCreditTokenFunc(walletSpy, memberAddress, {
      token: token.uid,
      amount: MIN_IOTA_AMOUNT,
    });

    const updatedDistribution = (
      await admin
        .firestore()
        .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
        .get()
    ).data();
    expect(updatedDistribution?.totalDeposit).toBe(0);

    const updatedToken = (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data();
    expect(updatedToken?.totalDeposit).toBe(0);
    await assertOrderedTokensCount(token.uid, 0);
  });

  it('Should create token order and should fail credit, not in cool down period', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(
      order.payload.targetAddress,
      order.payload.amount,
    );
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({
        saleStartDate: dateToTimestamp(dayjs().subtract(3, 'd').toDate()),
        coolDownEnd: dateToTimestamp(dayjs().subtract(1, 'm').toDate()),
      });

    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid, amount: MIN_IOTA_AMOUNT });
    await expectThrow(testEnv.wrap(creditToken)({}), WenError.token_not_in_cool_down_period.key);
  });

  it('Should throw, amount too much to refund', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(
      order.payload.targetAddress,
      order.payload.amount,
    );
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const distribution = (
      await admin
        .firestore()
        .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
        .get()
    ).data();
    expect(distribution?.totalDeposit).toBe(token.pricePerToken);

    mockWalletReturnValue(walletSpy, memberAddress, {
      token: token.uid,
      amount: MIN_IOTA_AMOUNT * 4,
    });
    await expectThrow(testEnv.wrap(creditToken)({}), WenError.not_enough_funds.key);
  });

  it('Should throw, amount too much to refund after second credit', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(
      order.payload.targetAddress,
      order.payload.amount,
    );
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({
        saleStartDate: dateToTimestamp(dayjs().subtract(3, 'd').toDate()),
        coolDownEnd: dateToTimestamp(dayjs().add(1, 'd').toDate()),
      });

    mockWalletReturnValue(walletSpy, memberAddress, {
      token: token.uid,
      amount: token.pricePerToken,
    });
    await testEnv.wrap(creditToken)({});

    mockWalletReturnValue(walletSpy, memberAddress, {
      token: token.uid,
      amount: token.pricePerToken,
    });
    await expectThrow(testEnv.wrap(creditToken)({}), WenError.not_enough_funds.key);
  });

  it('Should allow only for members', async () => {
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ access: Access.MEMBERS_ONLY });
    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid });
    await testEnv.wrap(orderToken)({});
    const newMember = await createMember(walletSpy);
    mockWalletReturnValue(walletSpy, newMember, { token: token.uid });
    await expectThrow(testEnv.wrap(orderToken)({}), WenError.you_are_not_part_of_space.key);
  });

  it('Should allow only for guardians', async () => {
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ access: Access.GUARDIANS_ONLY });

    const newMember = await createMember(walletSpy);
    mockWalletReturnValue(walletSpy, newMember, { uid: space.uid });
    await testEnv.wrap(joinSpace)({});

    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid });
    await testEnv.wrap(orderToken)({});

    mockWalletReturnValue(walletSpy, newMember, { token: token.uid });
    await expectThrow(testEnv.wrap(orderToken)({}), WenError.you_are_not_guardian_of_space.key);
  });

  it('Should throw, no badge so can not access', async () => {
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ access: Access.MEMBERS_WITH_BADGE, accessAwards: [wallet.getRandomEthAddress()] });
    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid });
    await expectThrow(testEnv.wrap(orderToken)({}), WenError.you_dont_have_required_badge.key);
  });

  it('Should throw, no nft so can not access', async () => {
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({
        access: Access.MEMBERS_WITH_NFT_FROM_COLLECTION,
        accessCollections: [wallet.getRandomEthAddress()],
      });
    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid });
    await expectThrow(testEnv.wrap(orderToken)({}), WenError.you_dont_have_required_NFTs.key);
  });

  it('Should create token order and should credit, not leave less then MIN amount', async () => {
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(
      order.payload.targetAddress,
      1.5 * MIN_IOTA_AMOUNT,
    );
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const distribution = (
      await admin
        .firestore()
        .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
        .get()
    ).data();
    expect(distribution?.totalDeposit).toBe(1.5 * MIN_IOTA_AMOUNT);

    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({
        saleStartDate: dateToTimestamp(dayjs().subtract(3, 'd').toDate()),
        coolDownEnd: dateToTimestamp(dayjs().add(1, 'd').toDate()),
      });

    const credit = await submitCreditTokenFunc(walletSpy, memberAddress, {
      token: token.uid,
      amount: MIN_IOTA_AMOUNT,
    });
    expect(credit.payload.amount).toBe(1.5 * MIN_IOTA_AMOUNT);
  });

  it('Should create order and deposit in parallel', async () => {
    const array = Array.from(Array(10));
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const amounts = array.map((_, index) => index * MIN_IOTA_AMOUNT);
    const total = array.reduce((sum, _, index) => sum + index * MIN_IOTA_AMOUNT, 0);
    const deposit = async (amount: number) => {
      const nextMilestone = await submitMilestoneFunc(order.payload.targetAddress, amount);
      await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
    };
    const promises = amounts.map(deposit);
    await Promise.all(promises);
    const distribution = <TokenDistribution>(
      (
        await admin
          .firestore()
          .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
          .get()
      ).data()
    );
    expect(distribution.totalDeposit).toBe(total);
    await assertOrderedTokensCount(token.uid, total / MIN_IOTA_AMOUNT);
  });

  it('Should fail, country blocked by default', async () => {
    mockIpCheck(true, { common: ['HU'] }, { countryCode: 'HU' });
    await expectThrow(
      submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid }),
      WenError.blocked_country.key,
    );
  });

  it('Should fail, country blocked for entity', async () => {
    mockIpCheck(true, { common: ['USA'], [token.uid]: ['USA', 'HU'] }, { countryCode: 'HU' });
    await expectThrow(
      submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid }),
      WenError.blocked_country.key,
    );
  });

  it('Should fail, country blocked for token', async () => {
    mockIpCheck(true, { common: ['USA'], token: ['HU'] }, { countryCode: 'HU' });
    await expectThrow(
      submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid }),
      WenError.blocked_country.key,
    );
  });
});
