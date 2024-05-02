import { build5Db } from '@build-5/database';
import {
  Access,
  COL,
  MIN_IOTA_AMOUNT,
  NetworkAddress,
  SOON_PROJECT_ID,
  SUB_COL,
  Space,
  Token,
  TokenDistribution,
  TokenStatus,
  Transaction,
  WEN_FUNC,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { orderTokenControl } from '../../src/controls/token/token.order';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { MEDIA, mockWalletReturnValue, testEnv } from '../set-up';
import { expectThrow, getRandomSymbol, mockIpCheck, submitMilestoneFunc } from './common';

const submitTokenOrderFunc = async <T>(address: NetworkAddress, params: T) => {
  mockWalletReturnValue(address, params);
  const order = await testEnv.wrap<Transaction>(WEN_FUNC.orderToken);
  expect(order?.createdOn).toBeDefined();
  return order;
};
const submitCreditTokenFunc = async <T>(address: NetworkAddress, params: T) => {
  mockWalletReturnValue(address, params);
  const order = await testEnv.wrap<Transaction>(WEN_FUNC.creditToken);
  expect(order?.createdOn).toBeDefined();
  return order;
};
const assertOrderedTokensCount = async (tokenId: string, expected: number) => {
  const token = <Token>await build5Db().doc(COL.TOKEN, tokenId).get();
  expect(token.tokensOrdered).toBe(expected);
};

describe('Token controller: ' + WEN_FUNC.orderToken, () => {
  let member: NetworkAddress;
  let space: Space;
  let token: Token;
  beforeEach(async () => {
    member = await testEnv.createMember();
    space = await testEnv.createSpace(member);
    const tokenId = wallet.getRandomEthAddress();
    const tokenUpsert = {
      project: SOON_PROJECT_ID,
      symbol: getRandomSymbol(),
      totalSupply: 1000,
      approved: true,
      rejected: false,
      icon: MEDIA,
      overviewGraphics: MEDIA,
      updatedOn: serverTime().toDate(),
      createdOn: serverTime().toDate(),
      space: space.uid,
      uid: tokenId,
      pricePerToken: MIN_IOTA_AMOUNT,
      allocations: JSON.stringify([
        { title: 'Public sale', isPublicSale: true, percentage: 50 },
        { title: 'Private', percentage: 50 },
      ]),
      createdBy: member,
      name: 'MyToken',
      saleLength: 86400000 * 2,
      saleStartDate: dayjs().subtract(1, 'd').toDate(),
      links: [],
      status: TokenStatus.AVAILABLE,
      totalDeposit: 0,
      totalAirdropped: 0,
      termsAndConditions: 'https://wen.soonaverse.com/token/terms-and-conditions',
      access: Access.OPEN,
      decimals: 6,
    };
    await build5Db().doc(COL.TOKEN, tokenId).upsert(tokenUpsert);
    token = (await build5Db().doc(COL.TOKEN, tokenId).get())!;
  });

  it('Should create token order', async () => {
    const order = await submitTokenOrderFunc(member, { token: token.uid });
    await submitMilestoneFunc(order);
    const distribution = await build5Db()
      .doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, member)
      .get();
    expect(distribution?.totalDeposit).toBe(MIN_IOTA_AMOUNT);
    await assertOrderedTokensCount(token.uid, 1);
  });

  it('Should order more token', async () => {
    const order = await submitTokenOrderFunc(member, { token: token.uid });
    await submitMilestoneFunc(order);
    const order2 = await submitTokenOrderFunc(member, { token: token.uid });
    await submitMilestoneFunc(order2);
    const distribution = await build5Db()
      .doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, member)
      .get();
    expect(distribution?.totalDeposit).toBe(MIN_IOTA_AMOUNT * 2);
    await assertOrderedTokensCount(token.uid, 2);
  });

  it('Should create token order and should credit some amount', async () => {
    for (const _ of [0, 1]) {
      const order = await submitTokenOrderFunc(member, { token: token.uid });
      await submitMilestoneFunc(order);
    }
    const distribution = await build5Db()
      .doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, member)
      .get();
    expect(distribution?.totalDeposit).toBe(MIN_IOTA_AMOUNT * 2);
    await build5Db()
      .doc(COL.TOKEN, token.uid)
      .update({
        saleStartDate: dayjs().subtract(3, 'd').toDate(),
        coolDownEnd: dayjs().add(1, 'd').toDate(),
      });
    await submitCreditTokenFunc(member, { token: token.uid, amount: MIN_IOTA_AMOUNT });
    const updatedDistribution = await build5Db()
      .doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, member)
      .get();
    expect(updatedDistribution?.totalDeposit).toBe(MIN_IOTA_AMOUNT);
    const updatedToken = await build5Db().doc(COL.TOKEN, token.uid).get();
    expect(updatedToken?.totalDeposit).toBe(MIN_IOTA_AMOUNT);
    await assertOrderedTokensCount(token.uid, 1);
  });

  it('Should create token order and should credit all amount', async () => {
    const order = await submitTokenOrderFunc(member, { token: token.uid });
    await submitMilestoneFunc(order);
    const distribution = await build5Db()
      .doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, member)
      .get();
    expect(distribution?.totalDeposit).toBe(MIN_IOTA_AMOUNT);
    await build5Db()
      .doc(COL.TOKEN, token.uid)
      .update({
        saleStartDate: dayjs().subtract(3, 'd').toDate(),
        coolDownEnd: dayjs().add(1, 'd').toDate(),
      });
    await submitCreditTokenFunc(member, { token: token.uid, amount: MIN_IOTA_AMOUNT });
    const updatedDistribution = await build5Db()
      .doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, member)
      .get();
    expect(updatedDistribution?.totalDeposit).toBe(0);
    const updatedToken = await build5Db().doc(COL.TOKEN, token.uid).get();
    expect(updatedToken?.totalDeposit).toBe(0);
    await assertOrderedTokensCount(token.uid, 0);
  });

  it('Should create token order and should fail credit, not in cool down period', async () => {
    const order = await submitTokenOrderFunc(member, { token: token.uid });
    await submitMilestoneFunc(order);
    await build5Db()
      .doc(COL.TOKEN, token.uid)
      .update({
        saleStartDate: dayjs().subtract(3, 'd').toDate(),
        coolDownEnd: dayjs().subtract(1, 'm').toDate(),
      });
    mockWalletReturnValue(member, { token: token.uid, amount: MIN_IOTA_AMOUNT });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.creditToken),
      WenError.token_not_in_cool_down_period.key,
    );
  });

  it('Should throw, amount too much to refund', async () => {
    const order = await submitTokenOrderFunc(member, { token: token.uid });
    await submitMilestoneFunc(order);
    const distribution = await build5Db()
      .doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, member)
      .get();
    expect(distribution?.totalDeposit).toBe(token.pricePerToken);
    mockWalletReturnValue(member, {
      token: token.uid,
      amount: MIN_IOTA_AMOUNT * 4,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.creditToken), WenError.not_enough_funds.key);
  });

  it('Should throw, amount too much to refund after second credit', async () => {
    const order = await submitTokenOrderFunc(member, { token: token.uid });
    await submitMilestoneFunc(order);
    await build5Db()
      .doc(COL.TOKEN, token.uid)
      .update({
        saleStartDate: dayjs().subtract(3, 'd').toDate(),
        coolDownEnd: dayjs().add(1, 'd').toDate(),
      });
    mockWalletReturnValue(member, {
      token: token.uid,
      amount: token.pricePerToken,
    });
    await testEnv.wrap(WEN_FUNC.creditToken);
    mockWalletReturnValue(member, {
      token: token.uid,
      amount: token.pricePerToken,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.creditToken), WenError.not_enough_funds.key);
  });

  it('Should allow only for members', async () => {
    await build5Db().doc(COL.TOKEN, token.uid).update({ access: Access.MEMBERS_ONLY });
    mockWalletReturnValue(member, { token: token.uid });
    await testEnv.wrap<Transaction>(WEN_FUNC.orderToken);
    const newMember = await testEnv.createMember();
    mockWalletReturnValue(newMember, { token: token.uid });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.orderToken),
      WenError.you_are_not_part_of_space.key,
    );
  });

  it('Should allow only for guardians', async () => {
    await build5Db().doc(COL.TOKEN, token.uid).update({ access: Access.GUARDIANS_ONLY });
    const newMember = await testEnv.createMember();
    mockWalletReturnValue(newMember, { uid: space.uid });
    await testEnv.wrap(WEN_FUNC.joinSpace);
    mockWalletReturnValue(member, { token: token.uid });
    await testEnv.wrap<Transaction>(WEN_FUNC.orderToken);

    mockWalletReturnValue(newMember, { token: token.uid });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.orderToken),
      WenError.you_are_not_guardian_of_space.key,
    );
  });

  it('Should throw, no badge so can not access', async () => {
    await build5Db()
      .doc(COL.TOKEN, token.uid)
      .update({
        access: Access.MEMBERS_WITH_BADGE,
        accessAwards: [wallet.getRandomEthAddress()],
      });

    mockWalletReturnValue(member, { token: token.uid });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.orderToken),
      WenError.you_dont_have_required_badge.key,
    );
  });

  it('Should throw, no nft so can not access', async () => {
    await build5Db()
      .doc(COL.TOKEN, token.uid)
      .update({
        access: Access.MEMBERS_WITH_NFT_FROM_COLLECTION,
        accessCollections: [wallet.getRandomEthAddress()],
      });

    mockWalletReturnValue(member, { token: token.uid });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.orderToken),
      WenError.you_dont_have_required_NFTs.key,
    );
  });

  it('Should create token order and should credit, not leave less then MIN amount', async () => {
    const order = await submitTokenOrderFunc(member, { token: token.uid });
    await submitMilestoneFunc(order, 1.5 * MIN_IOTA_AMOUNT);
    const distribution = await build5Db()
      .doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, member)
      .get();
    expect(distribution?.totalDeposit).toBe(1.5 * MIN_IOTA_AMOUNT);
    await build5Db()
      .doc(COL.TOKEN, token.uid)
      .update({
        saleStartDate: dayjs().subtract(3, 'd').toDate(),
        coolDownEnd: dayjs().add(1, 'd').toDate(),
      });
    const credit = await submitCreditTokenFunc(member, {
      token: token.uid,
      amount: MIN_IOTA_AMOUNT,
    });
    expect(credit.payload.amount).toBe(1.5 * MIN_IOTA_AMOUNT);
  });

  it('Should create order and deposit in parallel', async () => {
    const array = Array.from(Array(10));
    const order = await submitTokenOrderFunc(member, { token: token.uid });
    const amounts = array.map((_, index) => (index + 1) * MIN_IOTA_AMOUNT);
    const total = array.reduce((sum, _, index) => sum + (index + 1) * MIN_IOTA_AMOUNT, 0);
    const deposit = async (amount: number) => submitMilestoneFunc(order, amount);
    const promises = amounts.map(deposit);
    await Promise.all(promises);
    const distribution = <TokenDistribution>(
      await build5Db().doc(COL.TOKEN, token.uid, SUB_COL.DISTRIBUTION, member).get()
    );
    expect(distribution.totalDeposit).toBe(total);
    await assertOrderedTokensCount(token.uid, total / MIN_IOTA_AMOUNT);
  });

  it('Should fail, country blocked by default', async () => {
    mockIpCheck(true, { common: ['HU'] }, { countryCode: 'HU' });

    mockWalletReturnValue(member, { token: token.uid });
    const call = testEnv.mockWrap<Transaction>(orderTokenControl);
    await expectThrow(call, WenError.blocked_country.key);
  });

  it('Should fail, country blocked for entity', async () => {
    mockIpCheck(true, { common: ['USA'], [token.uid]: ['USA', 'HU'] }, { countryCode: 'HU' });

    mockWalletReturnValue(member, { token: token.uid });
    const call = testEnv.mockWrap<Transaction>(orderTokenControl);
    await expectThrow(call, WenError.blocked_country.key);
  });

  it('Should fail, country blocked for token', async () => {
    mockIpCheck(true, { common: ['USA'], token: ['HU'] }, { countryCode: 'HU' });

    mockWalletReturnValue(member, { token: token.uid });
    const call = testEnv.mockWrap<Transaction>(orderTokenControl);
    await expectThrow(call, WenError.blocked_country.key);
  });
});
