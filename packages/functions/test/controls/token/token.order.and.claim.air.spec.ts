import { database } from '@buildcore/database';
import {
  Access,
  COL,
  MIN_IOTA_AMOUNT,
  NetworkAddress,
  SOON_PROJECT_ID,
  SUB_COL,
  Space,
  Token,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { serverTime } from '../../../src/utils/dateTime.utils';
import * as wallet from '../../../src/utils/wallet.utils';
import { MEDIA, mockWalletReturnValue, testEnv } from '../../set-up';
import { getRandomSymbol, submitMilestoneFunc, tokenProcessed, wait } from '../common';

const submitTokenOrderFunc = async <T>(address: NetworkAddress, params: T) => {
  mockWalletReturnValue(address, params);
  const order = await testEnv.wrap<Transaction>(WEN_FUNC.orderToken);
  expect(order?.createdOn).toBeDefined();
  return order;
};

describe('Order and claim airdropped token test', () => {
  let memberAddress: NetworkAddress;
  let space: Space;
  let token: Token;
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
    await database().doc(COL.TOKEN, tokenId).upsert(tokenUpsert);
    token = (await database().doc(COL.TOKEN, tokenId).get())!;
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 5, recipient: memberAddress, vestingAt: dayjs().toDate() }],
    };
    mockWalletReturnValue(memberAddress, airdropRequest);
    await testEnv.wrap(WEN_FUNC.airdropToken);
  });

  it('Should order and claim dropped', async () => {
    const distributionDocRef = database().doc(
      COL.TOKEN,
      token.uid,
      SUB_COL.DISTRIBUTION,
      memberAddress,
    );
    let distribution = await distributionDocRef.get();
    expect(distribution!.totalUnclaimedAirdrop).toBe(5);
    const order = await submitTokenOrderFunc(memberAddress, { token: token.uid });
    await submitMilestoneFunc(order, 5 * token.pricePerToken);
    mockWalletReturnValue(memberAddress, { token: token.uid });
    const claimOrder = await testEnv.wrap<Transaction>(WEN_FUNC.claimAirdroppedToken);
    await submitMilestoneFunc(claimOrder);
    await wait(async () => {
      const snap = await database()
        .collection(COL.AIRDROP)
        .where('member', '==', memberAddress)
        .where('status', '==', TokenDropStatus.CLAIMED)
        .get();
      return snap.length === 1;
    });
    await database().doc(COL.TOKEN, token.uid).update({ status: TokenStatus.PROCESSING });
    await tokenProcessed(token.uid, 1, true);
    distribution = (await distributionDocRef.get())!;
    expect(distribution.tokenClaimed).toBe(5);
    expect(distribution.totalPaid).toBe(5 * token.pricePerToken);
    expect(distribution.tokenOwned).toBe(10);
    expect(distribution.totalUnclaimedAirdrop).toBe(0);
  });
});
