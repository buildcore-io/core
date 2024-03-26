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
  TransactionPayloadType,
  TransactionType,
  WEN_FUNC,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { dateToTimestamp, serverTime } from '../../../src/utils/dateTime.utils';
import * as wallet from '../../../src/utils/wallet.utils';
import { MEDIA, mockWalletReturnValue, testEnv } from '../../set-up';
import { getRandomSymbol, submitMilestoneFunc, wait } from '../common';

const submitTokenOrderFunc = async <T>(address: NetworkAddress, params: T) => {
  mockWalletReturnValue(address, params);
  const order = await testEnv.wrap<Transaction>(WEN_FUNC.orderToken);
  expect(order?.createdOn).toBeDefined();
  return order;
};
const setAvailableOrderAndCancelSale = async (
  token: Token,
  memberAddress: NetworkAddress,
  miotas: number,
) => {
  const tokenDocRef = build5Db().doc(COL.TOKEN, token.uid);
  const distributionDocRef = build5Db().doc(
    COL.TOKEN,
    token.uid,
    SUB_COL.DISTRIBUTION,
    memberAddress,
  );
  await tokenDocRef.update({
    saleLength: 86400000 * 2,
    saleStartDate: dayjs().subtract(1, 'd').toDate(),
    coolDownEnd: dayjs()
      .subtract(1, 'd')
      .add(86400000 * 2, 'ms')
      .toDate(),
  });
  const order = await submitTokenOrderFunc(memberAddress, { token: token.uid });
  await submitMilestoneFunc(order, miotas * MIN_IOTA_AMOUNT);
  const distribution = <TokenDistribution>await distributionDocRef.get();
  expect(distribution.totalDeposit).toBe(miotas * MIN_IOTA_AMOUNT);
  mockWalletReturnValue(memberAddress, { token: token.uid });
  await testEnv.wrap(WEN_FUNC.cancelPublicSale);
  await wait(async () => (await tokenDocRef.get())?.status === TokenStatus.AVAILABLE);
  const tokenData = <Token>await tokenDocRef.get();
  expect(tokenData.saleStartDate).toBeUndefined();
};

describe('Token controller: ' + WEN_FUNC.cancelPublicSale, () => {
  let memberAddress: NetworkAddress;
  let space: Space;
  let token: any;
  beforeEach(async () => {
    memberAddress = await testEnv.createMember();
    space = await testEnv.createSpace(memberAddress);
    const tokenId = wallet.getRandomEthAddress();
    const tokenUpsert = {
      project: SOON_PROJECT_ID,
      symbol: getRandomSymbol(),
      totalSupply: 10,
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
      createdBy: memberAddress,
      name: 'MyToken',
      links: [],
      status: TokenStatus.AVAILABLE,
      totalDeposit: 0,
      totalAirdropped: 0,
      termsAndConditions: 'https://wen.soonaverse.com/token/terms-and-conditions',
      access: Access.OPEN,
    };
    await build5Db().doc(COL.TOKEN, tokenId).upsert(tokenUpsert);
    token = (await build5Db().doc(COL.TOKEN, tokenId).get())!;
  });

  it('Should cancel public sale and refund buyers twice', async () => {
    const distributionDocRef = build5Db().doc(
      COL.TOKEN,
      token.uid,
      SUB_COL.DISTRIBUTION,
      memberAddress,
    );
    await setAvailableOrderAndCancelSale(token, memberAddress, 5);
    await setAvailableOrderAndCancelSale(token, memberAddress, 6);
    const distribution = <TokenDistribution>await distributionDocRef.get();
    expect(distribution.totalDeposit).toBe(0);
    const creditDocs = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('payload_type', '==', TransactionPayloadType.TOKEN_PURCHASE)
      .where('member', '==', memberAddress)
      .get();
    expect(creditDocs.map((d) => d?.payload?.amount!).sort((a, b) => a - b)).toEqual([
      5 * MIN_IOTA_AMOUNT,
      6 * MIN_IOTA_AMOUNT,
    ]);
  });

  it('Should cancel public sale and refund buyers twice, then finish sale', async () => {
    const distributionDocRef = build5Db().doc(
      COL.TOKEN,
      token.uid,
      SUB_COL.DISTRIBUTION,
      memberAddress,
    );
    await setAvailableOrderAndCancelSale(token, memberAddress, 5);
    await setAvailableOrderAndCancelSale(token, memberAddress, 6);
    let distribution = <TokenDistribution>await distributionDocRef.get();
    expect(distribution.totalDeposit).toBe(0);
    const creditDocs = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('payload_type', '==', TransactionPayloadType.TOKEN_PURCHASE)
      .where('member', '==', memberAddress)
      .get();
    expect(creditDocs.map((d) => d?.payload?.amount!).sort((a, b) => a - b)).toEqual([
      5 * MIN_IOTA_AMOUNT,
      6 * MIN_IOTA_AMOUNT,
    ]);
    const tokenDocRef = build5Db().doc(COL.TOKEN, token.uid);
    await tokenDocRef.update({
      saleLength: 86400000 * 2,
      saleStartDate: dayjs().subtract(1, 'd').toDate(),
      coolDownEnd: dayjs()
        .subtract(1, 'd')
        .add(86400000 * 2, 'ms')
        .toDate(),
    });
    const order = await submitTokenOrderFunc(memberAddress, { token: token.uid });
    await submitMilestoneFunc(order, 7 * MIN_IOTA_AMOUNT);
    await tokenDocRef.update({ status: TokenStatus.PROCESSING });
    await wait(async () => (await tokenDocRef.get())?.status === TokenStatus.PRE_MINTED);
    distribution = <TokenDistribution>await distributionDocRef.get();
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
    await build5Db()
      .doc(COL.TOKEN, token.uid)
      .update({
        allocations: JSON.stringify([{ title: 'public', percentage: 100, isPublicSale: true }]),
        public: true,
      });
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(memberAddress, updateData);
    const result = await testEnv.wrap<Token>(WEN_FUNC.setTokenAvailableForSale);
    token = await build5Db().doc(COL.TOKEN, result.uid).get();
    expect(token.saleStartDate!.toDate()).toEqual(
      dateToTimestamp(dayjs(publicTime.saleStartDate), true).toDate(),
    );
    mockWalletReturnValue(memberAddress, { token: token.uid });
    await testEnv.wrap(WEN_FUNC.cancelPublicSale);
    await wait(async () => {
      const tokenData = <Token>await build5Db().doc(COL.TOKEN, token.uid).get();
      return tokenData.status === TokenStatus.AVAILABLE;
    });
  });
});
