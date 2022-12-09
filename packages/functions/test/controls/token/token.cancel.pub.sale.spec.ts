import {
  COL,
  MIN_IOTA_AMOUNT,
  Space,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStatus,
  TransactionCreditType,
  TransactionType,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../../src/admin.config';
import {
  cancelPublicSale,
  orderToken,
  setTokenAvailableForSale,
} from '../../../src/controls/token.control';
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
  wait,
} from '../common';

let walletSpy: any;

const submitTokenOrderFunc = async <T>(spy: string, address: string, params: T) => {
  mockWalletReturnValue(spy, address, params);
  const order = await testEnv.wrap(orderToken)({});
  expect(order?.createdOn).toBeDefined();
  return order;
};

const setAvailableOrderAndCancelSale = async (
  token: Token,
  memberAddress: string,
  miotas: number,
) => {
  const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
  const distributionDocRef = admin
    .firestore()
    .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`);
  await tokenDocRef.update({
    saleLength: 86400000 * 2,
    saleStartDate: dateToTimestamp(dayjs().subtract(1, 'd').toDate()),
    coolDownEnd: dateToTimestamp(
      dayjs()
        .subtract(1, 'd')
        .add(86400000 * 2, 'ms')
        .toDate(),
    ),
  });
  const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
  const nextMilestone = await submitMilestoneFunc(
    order.payload.targetAddress,
    miotas * MIN_IOTA_AMOUNT,
  );
  await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

  const distribution = <TokenDistribution>(await distributionDocRef.get()).data();
  expect(distribution.totalDeposit).toBe(miotas * MIN_IOTA_AMOUNT);

  mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid });
  await testEnv.wrap(cancelPublicSale)({});
  await wait(async () => (await tokenDocRef.get()).data()?.status === TokenStatus.AVAILABLE);
  const tokenData = <Token>(await tokenDocRef.get()).data();
  expect(tokenData.saleStartDate).toBeUndefined();
};

describe('Token controller: ' + WEN_FUNC.cancelPublicSale, () => {
  let memberAddress: string;
  let space: Space;
  let token: any;

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
      links: [],
      status: TokenStatus.AVAILABLE,
      totalDeposit: 0,
      totalAirdropped: 0,
      termsAndConditions: 'https://wen.soonaverse.com/token/terms-and-conditions',
      access: 0,
    };
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  });

  it('Should cancel public sale and refund buyers twice', async () => {
    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`);
    await setAvailableOrderAndCancelSale(token, memberAddress, 5);
    await setAvailableOrderAndCancelSale(token, memberAddress, 6);
    const distribution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(distribution.totalDeposit).toBe(0);
    const creditDocs = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('payload.type', '==', TransactionCreditType.TOKEN_PURCHASE)
        .where('member', '==', memberAddress)
        .get()
    ).docs;
    expect(creditDocs.map((d) => d.data()?.payload?.amount).sort((a, b) => a - b)).toEqual([
      5 * MIN_IOTA_AMOUNT,
      6 * MIN_IOTA_AMOUNT,
    ]);
  });

  it('Should cancel public sale and refund buyers twice, then finish sale', async () => {
    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`);
    await setAvailableOrderAndCancelSale(token, memberAddress, 5);
    await setAvailableOrderAndCancelSale(token, memberAddress, 6);
    let distribution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(distribution.totalDeposit).toBe(0);
    const creditDocs = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('payload.type', '==', TransactionCreditType.TOKEN_PURCHASE)
        .where('member', '==', memberAddress)
        .get()
    ).docs;
    expect(creditDocs.map((d) => d.data()?.payload?.amount).sort((a, b) => a - b)).toEqual([
      5 * MIN_IOTA_AMOUNT,
      6 * MIN_IOTA_AMOUNT,
    ]);

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
    await tokenDocRef.update({
      saleLength: 86400000 * 2,
      saleStartDate: dateToTimestamp(dayjs().subtract(1, 'd').toDate()),
      coolDownEnd: dateToTimestamp(
        dayjs()
          .subtract(1, 'd')
          .add(86400000 * 2, 'ms')
          .toDate(),
      ),
    });
    const order = await submitTokenOrderFunc(walletSpy, memberAddress, { token: token.uid });
    const nextMilestone = await submitMilestoneFunc(
      order.payload.targetAddress,
      7 * MIN_IOTA_AMOUNT,
    );
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    await tokenDocRef.update({ status: TokenStatus.PROCESSING });
    await wait(async () => (await tokenDocRef.get()).data()?.status === TokenStatus.PRE_MINTED);

    distribution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(distribution.totalPaid).toBe(5 * MIN_IOTA_AMOUNT);
    expect(distribution.refundedAmount).toBe(2 * MIN_IOTA_AMOUNT);
    expect(distribution.tokenOwned).toBe(5);
  });

  it('Should cancel public sale before public sale start', async () => {
    let publicTime = {
      saleStartDate: dayjs().add(2, 'd').toDate(),
      saleLength: 86400000 * 2,
      coolDownLength: 86400000,
    };
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] });
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(walletSpy, memberAddress, updateData);
    const result = await testEnv.wrap(setTokenAvailableForSale)({});
    expect(result?.saleStartDate.toDate()).toEqual(
      dateToTimestamp(dayjs(publicTime.saleStartDate), true).toDate(),
    );

    mockWalletReturnValue(walletSpy, memberAddress, { token: token.uid });
    await testEnv.wrap(cancelPublicSale)({});

    await wait(async () => {
      const tokenData = <Token>(
        (await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data()
      );
      return tokenData.status === TokenStatus.AVAILABLE;
    });
  });
});