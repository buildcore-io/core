import {
  Access,
  Bucket,
  COL,
  MAX_TOTAL_TOKEN_SUPPLY,
  MIN_IOTA_AMOUNT,
  RANKING_TEST,
  Space,
  StakeType,
  SUB_COL,
  Token,
  TokenAllocation,
  TokenDistribution,
  TokenStats,
  TokenStatus,
  Transaction,
  TransactionCreditType,
  TransactionIgnoreWalletReason,
  TransactionOrderType,
  TransactionType,
  WenError,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { rankController } from '../../src/controls/rank.control';
import { airdropToken, claimAirdroppedToken } from '../../src/controls/token-airdrop.control';
import {
  cancelPublicSale,
  createToken,
  orderToken,
  setTokenAvailableForSale,
  updateToken,
} from '../../src/controls/token.control';
import { voteController } from '../../src/controls/vote.control';
import * as config from '../../src/utils/config.utils';
import { cOn, dateToTimestamp, serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { MEDIA, testEnv } from '../set-up';
import {
  createMember,
  createRoyaltySpaces,
  createSpace,
  expectThrow,
  getRandomSymbol,
  milestoneProcessed,
  mockWalletReturnValue,
  submitMilestoneFunc,
  tokenProcessed,
  wait,
} from './common';

let walletSpy: any;
let isProdSpy: jest.SpyInstance<boolean, []>;

const dummyToken = (space: string) =>
  ({
    name: 'MyToken',
    symbol: getRandomSymbol(),
    space,
    totalSupply: 1000,
    allocations: <TokenAllocation[]>[{ title: 'Allocation1', percentage: 100 }],
    icon: MEDIA,
    overviewGraphics: MEDIA,
    termsAndConditions: 'https://wen.soonaverse.com/token/terms-and-conditions',
    access: 0,
  } as any);

const submitTokenOrderFunc = async <T>(spy: string, address: string, params: T) => {
  mockWalletReturnValue(spy, address, params);
  const order = await testEnv.wrap(orderToken)({});
  expect(order?.createdOn).toBeDefined();
  return order;
};

const saveSoon = async () => {
  const soons = await admin.firestore().collection(COL.TOKEN).where('symbol', '==', 'SOON').get();
  await Promise.all(soons.docs.map((d) => d.ref.delete()));

  const soonTokenId = wallet.getRandomEthAddress();
  await admin
    .firestore()
    .doc(`${COL.TOKEN}/${soonTokenId}`)
    .create({ uid: soonTokenId, symbol: 'SOON' });
  return soonTokenId;
};

describe('Token controller: ' + WEN_FUNC.cToken, () => {
  let memberAddress: string;
  let space: Space;
  let token: any;
  let soonTokenId: string;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    isProdSpy = jest.spyOn(config, 'isProdEnv');
    memberAddress = await createMember(walletSpy);
    space = await createSpace(walletSpy, memberAddress);
    token = dummyToken(space.uid);
    soonTokenId = await saveSoon();
  });

  it('Should create token', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, token);
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
  });

  it('Should throw, invalid icon url', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, { ...token, icon: 'asd' });
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key);

    mockWalletReturnValue(walletSpy, memberAddress, {
      ...token,
      icon: `https://firebasestorage.googleapis.com/v0/b/${Bucket.DEV}/o/`,
    });
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key);
  });

  it('Should create token, verify soon', async () => {
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${soonTokenId}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
      .create({
        stakes: {
          [StakeType.DYNAMIC]: {
            value: 10 * MIN_IOTA_AMOUNT,
          },
        },
      });

    mockWalletReturnValue(walletSpy, memberAddress, token);
    isProdSpy.mockReturnValue(true);
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
    isProdSpy.mockRestore();
  });

  it('Should create token with max token supply', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      ...token,
      totalSupply: MAX_TOTAL_TOKEN_SUPPLY,
    });
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
  });

  it('Should create, one public sale', async () => {
    token.allocations = [{ title: 'asd', percentage: 100, isPublicSale: true }];
    const saleStartDate = dayjs().add(8, 'day');
    token.saleStartDate = saleStartDate.toDate();
    token.saleLength = 86400000;
    token.coolDownLength = 86400000;
    token.autoProcessAt100Percent = true;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
    expect(result?.saleStartDate.toDate()).toEqual(dateToTimestamp(saleStartDate, true).toDate());
    expect(result?.saleLength).toBe(86400000);
    expect(result?.coolDownEnd.toDate()).toEqual(
      dateToTimestamp(
        dayjs(saleStartDate).add(token.saleLength + token.coolDownLength, 'ms'),
        true,
      ).toDate(),
    );
    expect(result?.autoProcessAt100Percent).toBe(true);
  });

  it('Should create, one public sale, no cooldown period', async () => {
    token.allocations = [{ title: 'asd', percentage: 100, isPublicSale: true }];
    const saleStartDate = dayjs().add(8, 'day');
    token.saleStartDate = saleStartDate.toDate();
    token.saleLength = 86400000;
    token.coolDownLength = 0;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
    expect(result?.saleStartDate.toDate()).toEqual(dateToTimestamp(saleStartDate, true).toDate());
    expect(result?.saleLength).toBe(86400000);
    expect(result?.coolDownEnd.toDate()).toEqual(
      dateToTimestamp(dayjs(saleStartDate).add(token.saleLength, 'ms'), true).toDate(),
    );
  });

  it('Should not allow two tokens', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await testEnv.wrap(createToken)({});
    mockWalletReturnValue(walletSpy, memberAddress, dummyToken(space.uid));
    await expectThrow(testEnv.wrap(createToken)({}), WenError.token_already_exists_for_space.key);
  });

  it('Should only allow two tokens if first rejected', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, token);
    const cToken = await testEnv.wrap(createToken)({});
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${cToken.uid}`)
      .update({ approved: false, rejected: true });
    mockWalletReturnValue(walletSpy, memberAddress, dummyToken(space.uid));
    const secondToken = await testEnv.wrap(createToken)({});
    expect(secondToken.uid).toBeDefined();
  });

  it('Should throw, no name', async () => {
    delete token.name;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key);
  });

  it('Should throw, no terms and conditions', async () => {
    delete token.termsAndConditions;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key);
  });

  it('Should throw, no symbol', async () => {
    delete token.symbol;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key);
  });

  it('Should throw, no space', async () => {
    delete token.space;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key);
  });

  it('Should throw, no valid space address', async () => {
    space = await createSpace(walletSpy, memberAddress);
    await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).update({ validatedAddress: {} });
    token.space = space.uid;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(
      testEnv.wrap(createToken)({}),
      WenError.space_must_have_validated_address.key,
    );
  });

  it('Should throw, no totalSupply', async () => {
    delete token.totalSupply;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key);
  });

  it('Should throw, no allocations', async () => {
    delete token.allocations;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key);
  });

  it('Should throw, wrong total percentage', async () => {
    token.allocations = [
      { title: 'asd', percentage: 50 },
      { title: 'ccc', percentage: 40 },
    ];
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key);
  });

  it('Should throw, more then one public sale', async () => {
    token.allocations = [
      { title: 'asd', percentage: 50, isPublicSale: true },
      { title: 'ccc', percentage: 50, isPublicSale: true },
    ];
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key);
  });

  it('Should throw, past start date', async () => {
    token.startDate = dayjs().subtract(1, 'd').toDate();
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key);
  });

  it('Should throw, creator is not guardian', async () => {
    mockWalletReturnValue(walletSpy, wallet.getRandomEthAddress(), token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.you_are_not_guardian_of_space.key);
  });

  it('Should create with public sale but no date', async () => {
    const token: any = dummyToken(space.uid);
    token.allocations = [{ title: 'asd', percentage: 100, isPublicSale: true }];
    mockWalletReturnValue(walletSpy, memberAddress, token);
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
  });

  it('Should throw, no public sale', async () => {
    const token: any = dummyToken(space.uid);
    token.saleStartDate = dayjs().add(8, 'd').toDate();
    token.saleLength = 86400000;
    token.coolDownLength = 86400000;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.no_token_public_sale.key);
  });

  it('Should throw, when public sale data is incomplete', async () => {
    const token: any = dummyToken(space.uid);
    token.allocations = [{ title: 'asd', percentage: 100, isPublicSale: true }];

    token.saleStartDate = dayjs().add(8, 'd').toDate();
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key);

    token.saleLength = 86400000;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key);

    token.coolDownLength = 86400000;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
  });

  it('Should throw, token symbol not unique', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await testEnv.wrap(createToken)({});
    const space = await createSpace(walletSpy, memberAddress);
    const data = dummyToken(space.uid);
    mockWalletReturnValue(walletSpy, memberAddress, { ...data, symbol: token.symbol });
    await expectThrow(
      testEnv.wrap(createToken)({}),
      WenError.token_symbol_must_be_globally_unique.key,
    );
  });

  it('Should throw, space does not exist', async () => {
    token.space = wallet.getRandomEthAddress();
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.you_are_not_guardian_of_space.key);
  });

  it('Should create with short description', async () => {
    token.shortDescriptionTitle = 'shortDescriptionTitle';
    token.shortDescription = 'shortDescription';
    mockWalletReturnValue(walletSpy, memberAddress, token);
    const result = await testEnv.wrap(createToken)({});
    expect(result.shortDescriptionTitle).toBe('shortDescriptionTitle');
    expect(result.shortDescription).toBe('shortDescription');
  });

  it('Should throw, accessAwards required if access is MEMBERS_WITH_BADGE', async () => {
    token.access = Access.MEMBERS_WITH_BADGE;
    token.accessAwards = [wallet.getRandomEthAddress()];
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await testEnv.wrap(createToken)({});
    token.accessAwards = [];
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key);
  });

  it('Should throw, accessCollections required if access is MEMBERS_WITH_NFT_FROM_COLLECTION', async () => {
    token.access = Access.MEMBERS_WITH_NFT_FROM_COLLECTION;
    token.accessCollections = [wallet.getRandomEthAddress()];
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await testEnv.wrap(createToken)({});
    token.accessCollections = [];
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key);
  });

  it('Should throw, no tokens staked', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, token);
    isProdSpy.mockReturnValue(true);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.no_staked_soon.key);
    isProdSpy.mockRestore();
  });
});

describe('Token controller: ' + WEN_FUNC.uToken, () => {
  let memberAddress: string;
  let space: Space;
  let token: any;

  const data = {
    shortDescriptionTitle: null,
    shortDescription: null,
    name: null,
    uid: null,
    title: null,
    description: null,
  };

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy);
    space = await createSpace(walletSpy, memberAddress);
    mockWalletReturnValue(walletSpy, memberAddress, dummyToken(space.uid));
    token = await testEnv.wrap(createToken)({});
  });

  it('Should update token', async () => {
    const updateData = {
      ...data,
      name: 'TokenName2',
      uid: token.uid,
      title: 'title',
      description: 'description',
      pricePerToken: 2 * MIN_IOTA_AMOUNT,
    };
    mockWalletReturnValue(walletSpy, memberAddress, updateData);
    const result = await testEnv.wrap(updateToken)({});
    expect(result.name).toBe(updateData.name);
    expect(result.title).toBe(updateData.title);
    expect(result.description).toBe(updateData.description);
    expect(result.pricePerToken).toBe(updateData.pricePerToken);
  });

  it('Should update token - remove description', async () => {
    const updateData = { ...data, name: token.name, uid: token.uid, title: 'title2' };
    mockWalletReturnValue(walletSpy, memberAddress, updateData);
    const result = await testEnv.wrap(updateToken)({});
    expect(result.name).toBe(token.name);
    expect(result.title).toBe(updateData.title);
    expect(result.description).toBe(updateData.description);
  });

  it('Should throw, not owner', async () => {
    const updateData = {
      ...data,
      name: 'TokenName2',
      uid: token.uid,
      title: 'title',
      description: 'description',
    };
    mockWalletReturnValue(walletSpy, wallet.getRandomEthAddress(), updateData);
    await expectThrow(testEnv.wrap(updateToken)({}), WenError.you_are_not_guardian_of_space.key);
  });

  it('Should throw, invalid staus', async () => {
    const updateData = {
      ...data,
      name: 'TokenName2',
      uid: token.uid,
      title: 'title',
      description: 'description',
    };
    mockWalletReturnValue(walletSpy, wallet.getRandomEthAddress(), updateData);
    await expectThrow(testEnv.wrap(updateToken)({}), WenError.you_are_not_guardian_of_space.key);
  });

  it('Should update short description', async () => {
    const updateData = { ...data, name: token.name, uid: token.uid, title: 'title2' };
    mockWalletReturnValue(walletSpy, memberAddress, updateData);

    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ status: TokenStatus.CANCEL_SALE });
    await expectThrow(testEnv.wrap(updateToken)({}), WenError.token_in_invalid_status.key);

    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ status: TokenStatus.PRE_MINTED });
    await expectThrow(testEnv.wrap(updateToken)({}), WenError.token_in_invalid_status.key);

    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ status: TokenStatus.MINTED });
    await expectThrow(testEnv.wrap(updateToken)({}), WenError.token_in_invalid_status.key);

    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ status: TokenStatus.BASE });
    await expectThrow(testEnv.wrap(updateToken)({}), WenError.token_in_invalid_status.key);

    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ status: TokenStatus.AVAILABLE });
    const result = await testEnv.wrap(updateToken)({});
    expect(result.name).toBe(token.name);
  });
});

describe('Token controller: ' + WEN_FUNC.setTokenAvailableForSale, () => {
  let memberAddress: string;
  let space: Space;
  let token: any;
  let publicTime = {
    saleStartDate: dayjs().toDate(),
    saleLength: 86400000 * 2,
    coolDownLength: 86400000,
  };

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy);
    space = await createSpace(walletSpy, memberAddress);
    mockWalletReturnValue(walletSpy, memberAddress, dummyToken(space.uid));
    token = await testEnv.wrap(createToken)({});
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: true });
  });

  it('Should throw, not approved', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false });
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(walletSpy, memberAddress, updateData);
    await expectThrow(testEnv.wrap(setTokenAvailableForSale)({}), WenError.token_not_approved.key);
  });

  it('Should throw, rejected', async () => {
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ approved: true, rejected: true });
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(walletSpy, memberAddress, updateData);
    await expectThrow(testEnv.wrap(setTokenAvailableForSale)({}), WenError.token_not_approved.key);
  });

  it('Should throw, not on public sale', async () => {
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(walletSpy, memberAddress, updateData);
    await expectThrow(
      testEnv.wrap(setTokenAvailableForSale)({}),
      WenError.no_token_public_sale.key,
    );
  });

  it('Should throw, not guardian', async () => {
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(walletSpy, wallet.getRandomEthAddress(), updateData);
    await expectThrow(
      testEnv.wrap(setTokenAvailableForSale)({}),
      WenError.you_are_not_guardian_of_space.key,
    );
  });

  it('Should set public availability', async () => {
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] });
    const updateData = { token: token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(walletSpy, memberAddress, updateData);
    const result = await testEnv.wrap(setTokenAvailableForSale)({});
    expect(result?.uid).toBeDefined();
    expect(result?.saleStartDate.toDate()).toEqual(
      dateToTimestamp(dayjs(publicTime.saleStartDate), true).toDate(),
    );
    expect(result?.saleLength).toBe(2 * 86400000);
    expect(result?.coolDownEnd.toDate()).toEqual(
      dateToTimestamp(
        dayjs(publicTime.saleStartDate).add(86400000 * 2 + 86400000, 'ms'),
        true,
      ).toDate(),
    );
    expect(result?.autoProcessAt100Percent).toBe(false);
  });

  it('Should set public availability', async () => {
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] });
    const updateData = {
      token: token.uid,
      ...publicTime,
      autoProcessAt100Percent: true,
      pricePerToken: MIN_IOTA_AMOUNT,
    };
    mockWalletReturnValue(walletSpy, memberAddress, updateData);
    const result = await testEnv.wrap(setTokenAvailableForSale)({});
    expect(result?.uid).toBeDefined();
    expect(result?.saleStartDate.toDate()).toEqual(
      dateToTimestamp(dayjs(publicTime.saleStartDate), true).toDate(),
    );
    expect(result?.saleLength).toBe(2 * 86400000);
    expect(result?.coolDownEnd.toDate()).toEqual(
      dateToTimestamp(
        dayjs(publicTime.saleStartDate).add(86400000 * 2 + 86400000, 'ms'),
        true,
      ).toDate(),
    );
    expect(result?.autoProcessAt100Percent).toBe(true);
  });

  it('Should throw, can not set public availability twice', async () => {
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] });
    mockWalletReturnValue(walletSpy, memberAddress, {
      token: token.uid,
      ...publicTime,
      pricePerToken: MIN_IOTA_AMOUNT,
    });
    await testEnv.wrap(setTokenAvailableForSale)({});

    mockWalletReturnValue(walletSpy, memberAddress, {
      token: token.uid,
      ...publicTime,
      pricePerToken: MIN_IOTA_AMOUNT,
    });
    await expectThrow(
      testEnv.wrap(setTokenAvailableForSale)({}),
      WenError.public_sale_already_set.key,
    );
  });

  it('Should set no cool down length', async () => {
    const docRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
    await docRef.update({
      allocations: [{ title: 'public', percentage: 100, isPublicSale: true }],
    });
    const publicTime = {
      saleStartDate: dayjs().toDate(),
      saleLength: 86400000 * 2,
      coolDownLength: 0,
    };
    mockWalletReturnValue(walletSpy, memberAddress, {
      token: token.uid,
      ...publicTime,
      pricePerToken: MIN_IOTA_AMOUNT,
    });
    const result = await testEnv.wrap(setTokenAvailableForSale)({});
    expect(result?.saleStartDate.toDate()).toEqual(
      dateToTimestamp(dayjs(publicTime.saleStartDate), true).toDate(),
    );
    expect(result?.saleLength).toBe(publicTime.saleLength);
    expect(result?.coolDownEnd.toDate()).toEqual(
      dateToTimestamp(
        dayjs(publicTime.saleStartDate).add(publicTime.saleLength, 'ms'),
        true,
      ).toDate(),
    );
  });
});

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

describe('Token airdrop test', () => {
  let guardianAddress: string;
  let memberAddress: string;
  let space: Space;
  let token: Token;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardianAddress = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardianAddress);
    const dummyTokenData = dummyToken(space.uid);
    dummyTokenData.saleStartDate = dayjs().add(8, 'day').toDate();
    dummyTokenData.saleLength = 86400000;
    dummyTokenData.coolDownLength = 86400000;
    dummyTokenData.allocations = [
      { title: 'Private', percentage: 90 },
      { title: 'Public', percentage: 10, isPublicSale: true },
    ];
    mockWalletReturnValue(walletSpy, guardianAddress, dummyTokenData);
    token = await testEnv.wrap(createToken)({});
    memberAddress = await createMember(walletSpy);
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: true });
  });

  it('Should fail, token not approved', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false });
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 900, recipient: guardianAddress, vestingAt: dayjs().toDate() }],
    };
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest);
    await expectThrow(testEnv.wrap(airdropToken)({}), WenError.token_not_approved.key);
  });

  it('Should airdrop token', async () => {
    const vestingAt = dayjs().toDate();
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 900, recipient: guardianAddress, vestingAt }],
    };
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest);
    const airdrops = await testEnv.wrap(airdropToken)({});
    expect(airdrops.length).toBe(1);
    expect(
      airdrops[0].tokenDrops.map((d: any) => ({ count: d.count, vestingAt: d.vestingAt })),
    ).toEqual([{ count: 900, vestingAt: dateToTimestamp(vestingAt) }]);
    expect(airdrops[0].uid).toBe(guardianAddress);
  });

  it('Should airdrop batch token', async () => {
    const vestingAt = dayjs().toDate();
    const airdropRequest = {
      token: token.uid,
      drops: [
        { count: 800, recipient: guardianAddress, vestingAt },
        { count: 100, recipient: memberAddress, vestingAt },
      ],
    };
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest);
    const airdrops = await testEnv.wrap(airdropToken)({});
    expect(airdrops.length).toBe(2);
    expect(
      airdrops[0].tokenDrops.map((d: any) => ({ count: d.count, vestingAt: d.vestingAt })),
    ).toEqual([{ count: 800, vestingAt: dateToTimestamp(vestingAt) }]);
    expect(airdrops[0].uid).toBe(guardianAddress);
    expect(
      airdrops[1].tokenDrops.map((d: any) => ({ count: d.count, vestingAt: d.vestingAt })),
    ).toEqual([{ count: 100, vestingAt: dateToTimestamp(vestingAt) }]);
    expect(airdrops[1].uid).toBe(memberAddress);
  });

  it('Should throw, not enough tokens', async () => {
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 1000, recipient: guardianAddress, vestingAt: dayjs().toDate() }],
    };
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest);
    await expectThrow(testEnv.wrap(airdropToken)({}), WenError.no_tokens_available_for_airdrop.key);
  });

  it('Should throw, no vesting', async () => {
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 1000, recipient: guardianAddress }],
    };
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest);
    await expectThrow(testEnv.wrap(airdropToken)({}), WenError.invalid_params.key);
  });

  it('Should throw, not guardian', async () => {
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 50, recipient: guardianAddress, vestingAt: dayjs().toDate() }],
    };
    mockWalletReturnValue(walletSpy, memberAddress, airdropRequest);
    await expectThrow(testEnv.wrap(airdropToken)({}), WenError.you_are_not_guardian_of_space.key);
  });

  it('Should throw at second drop', async () => {
    const vestingAt = dayjs().toDate();
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 900, recipient: guardianAddress, vestingAt }],
    };
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest);
    const airdrops = await testEnv.wrap(airdropToken)({});
    expect(
      airdrops[0].tokenDrops.map((d: any) => ({ count: d.count, vestingAt: d.vestingAt })),
    ).toEqual([{ count: 900, vestingAt: dateToTimestamp(vestingAt) }]);
    expect(airdrops[0].uid).toBe(guardianAddress);

    const airdropRequest2 = {
      token: token.uid,
      drops: [{ count: 100, recipient: guardianAddress, vestingAt: dayjs().toDate() }],
    };
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest2);
    await expectThrow(testEnv.wrap(airdropToken)({}), WenError.no_tokens_available_for_airdrop.key);
  });

  it('Should drop multiple for same user', async () => {
    const vestingAt = dayjs().toDate();
    const airdropRequest = {
      token: token.uid,
      drops: [
        { count: 400, recipient: guardianAddress, vestingAt },
        { count: 50, recipient: memberAddress, vestingAt },
      ],
    };
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest);
    await testEnv.wrap(airdropToken)({});
    await testEnv.wrap(airdropToken)({});

    const guardDistribution = <TokenDistribution>(
      (
        await admin
          .firestore()
          .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardianAddress}`)
          .get()
      ).data()
    );
    expect(guardDistribution.tokenDrops?.length).toBe(2);
  });
});

describe('Claim airdropped token test', () => {
  let guardianAddress: string;
  let space: Space;
  let token: Token;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardianAddress = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardianAddress);
    const dummyTokenData = dummyToken(space.uid);
    dummyTokenData.saleStartDate = dayjs().add(8, 'day').toDate();
    dummyTokenData.saleLength = 86400000;
    dummyTokenData.coolDownLength = 86400000;
    dummyTokenData.allocations = [
      { title: 'Private', percentage: 90 },
      { title: 'Public', percentage: 10, isPublicSale: true },
    ];
    mockWalletReturnValue(walletSpy, guardianAddress, dummyTokenData);
    token = await testEnv.wrap(createToken)({});
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: true });

    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 450, recipient: guardianAddress, vestingAt: dayjs().toDate() }],
    };
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest);
    await testEnv.wrap(airdropToken)({});
  });

  it('Should claim token', async () => {
    mockWalletReturnValue(walletSpy, guardianAddress, { token: token.uid });
    const order = await testEnv.wrap(claimAirdroppedToken)({});
    const nextMilestone = await submitMilestoneFunc(
      order.payload.targetAddress,
      order.payload.amount,
    );
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const orderTran = <Transaction>(
      (await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).get()).data()
    );
    expect(orderTran.member).toBe(guardianAddress);
    expect(orderTran.payload.type).toBe(TransactionOrderType.TOKEN_AIRDROP);

    const paymentsSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('payload.sourceTransaction', 'array-contains', orderTran.uid)
      .get();
    const types = paymentsSnap.docs.map((d) => d.data().type).sort();
    expect(types).toEqual([TransactionType.BILL_PAYMENT, TransactionType.PAYMENT]);

    const airdrop = (
      await admin
        .firestore()
        .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardianAddress}`)
        .get()
    ).data();
    expect(airdrop?.tokenDrops.length).toBe(0);
    expect(airdrop?.tokenDropsHistory.length).toBe(1);
    expect(airdrop?.tokenDropsHistory[0].createdOn).toBeDefined();
    expect(airdrop?.tokenClaimed).toBe(450);
    expect(airdrop?.tokenOwned).toBe(450);

    const transactionsQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', guardianAddress);
    const transactions = (await transactionsQuery.get()).docs.map((d) => d.data() as Transaction);
    const billPayment = transactions.find((t) => t.type === TransactionType.BILL_PAYMENT);
    expect(billPayment?.ignoreWallet).toBe(true);
    expect(billPayment?.ignoreWalletReason).toBe(
      TransactionIgnoreWalletReason.PRE_MINTED_AIRDROP_CLAIM,
    );
    const creditPayment = transactions.find((t) => t.type === TransactionType.CREDIT);
    expect(creditPayment).toBeDefined();
  });

  it('Should claim multiple drops token', async () => {
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 450, recipient: guardianAddress, vestingAt: dayjs().toDate() }],
    };
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest);
    await testEnv.wrap(airdropToken)({});

    mockWalletReturnValue(walletSpy, guardianAddress, { token: token.uid });
    const order = await testEnv.wrap(claimAirdroppedToken)({});
    const nextMilestone = await submitMilestoneFunc(
      order.payload.targetAddress,
      order.payload.amount,
    );
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const orderTran = <Transaction>(
      (await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).get()).data()
    );
    expect(orderTran.member).toBe(guardianAddress);
    expect(orderTran.payload.type).toBe(TransactionOrderType.TOKEN_AIRDROP);

    const paymentsSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('payload.sourceTransaction', 'array-contains', orderTran.uid)
      .get();
    const types = paymentsSnap.docs.map((d) => d.data().type).sort();
    expect(types).toEqual([TransactionType.BILL_PAYMENT, TransactionType.PAYMENT]);

    const airdrop = (
      await admin
        .firestore()
        .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardianAddress}`)
        .get()
    ).data();
    expect(airdrop?.tokenDrops.length).toBe(0);
    expect(airdrop?.tokenDropsHistory.length).toBe(2);
    expect(airdrop?.tokenClaimed).toBe(900);
    expect(airdrop?.tokenOwned).toBe(900);
  });

  it('Should claim only vested drops', async () => {
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 450, recipient: guardianAddress, vestingAt: dayjs().add(1, 'd').toDate() }],
    };
    mockWalletReturnValue(walletSpy, guardianAddress, airdropRequest);
    await testEnv.wrap(airdropToken)({});

    mockWalletReturnValue(walletSpy, guardianAddress, { token: token.uid });
    const order = await testEnv.wrap(claimAirdroppedToken)({});
    const nextMilestone = await submitMilestoneFunc(
      order.payload.targetAddress,
      order.payload.amount,
    );
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const orderTran = <Transaction>(
      (await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).get()).data()
    );
    expect(orderTran.member).toBe(guardianAddress);
    expect(orderTran.payload.type).toBe(TransactionOrderType.TOKEN_AIRDROP);

    const paymentsSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('payload.sourceTransaction', 'array-contains', orderTran.uid)
      .get();
    const types = paymentsSnap.docs.map((d) => d.data().type).sort();
    expect(types).toEqual([TransactionType.BILL_PAYMENT, TransactionType.PAYMENT]);

    const airdrop = (
      await admin
        .firestore()
        .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardianAddress}`)
        .get()
    ).data();
    expect(airdrop?.tokenDrops.length).toBe(1);
    expect(airdrop?.tokenDropsHistory.length).toBe(1);
    expect(airdrop?.tokenClaimed).toBe(450);
    expect(airdrop?.tokenOwned).toBe(450);
  });

  it('Should claim same in parallel', async () => {
    mockWalletReturnValue(walletSpy, guardianAddress, { token: token.uid });
    const claimToken = async () => {
      const order = await testEnv.wrap(claimAirdroppedToken)({});
      await new Promise((r) => setTimeout(r, 1000));
      const nextMilestone = await submitMilestoneFunc(
        order.payload.targetAddress,
        order.payload.amount,
      );
      await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);
      return order;
    };
    const promises = [claimToken(), claimToken()];
    await Promise.all(promises);

    const distribution = <TokenDistribution>(
      (
        await admin
          .firestore()
          .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardianAddress}`)
          .get()
      ).data()
    );
    expect(distribution.tokenDrops?.length).toBe(0);
    expect(distribution.tokenDropsHistory?.length).toBe(1);
    expect(distribution.tokenClaimed).toBe(450);
    expect(distribution.tokenOwned).toBe(450);

    const creditSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', guardianAddress)
      .where('type', '==', TransactionType.CREDIT)
      .where('payload.token', '==', token.uid)
      .get();
    expect(creditSnap.size).toBe(2);

    const billPaymentSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', guardianAddress)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload.token', '==', token.uid)
      .get();
    expect(billPaymentSnap.size).toBe(1);
  });

  it('Should throw, token is minted', async () => {
    mockWalletReturnValue(walletSpy, guardianAddress, { token: token.uid });
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ status: TokenStatus.MINTED });
    await expectThrow(testEnv.wrap(claimAirdroppedToken)({}), WenError.token_in_invalid_status.key);
  });
});

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
    const claimNxtMilestone = await submitMilestoneFunc(
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );
    await milestoneProcessed(claimNxtMilestone.milestone, claimNxtMilestone.tranId);

    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}`)
      .update({ status: TokenStatus.PROCESSING });
    await tokenProcessed(token.uid, 1, true);

    const distribution = <TokenDistribution>(
      (
        await admin
          .firestore()
          .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
          .get()
      ).data()
    );
    expect(distribution.tokenClaimed).toBe(5);
    expect(distribution.totalPaid).toBe(5 * token.pricePerToken);
    expect(distribution.tokenOwned).toBe(10);
  });
});

describe('Token vote test', () => {
  let memberAddress: string;
  let space: Space;
  let token: any;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    isProdSpy = jest.spyOn(config, 'isProdEnv');
    memberAddress = await createMember(walletSpy);
    space = await createSpace(walletSpy, memberAddress);
    mockWalletReturnValue(walletSpy, memberAddress, dummyToken(space.uid));
    token = await testEnv.wrap(createToken)({});
    await saveSoon();
  });

  it('Should throw, no token', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      collection: COL.TOKEN,
      uid: wallet.getRandomEthAddress(),
      direction: 1,
    });
    await expectThrow(testEnv.wrap(voteController)({}), WenError.token_does_not_exist.key);
  });

  it('Should throw, invalid direction', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      collection: COL.TOKEN,
      uid: token.uid,
      direction: 2,
    });
    await expectThrow(testEnv.wrap(voteController)({}), WenError.invalid_params.key);
  });

  it('Should throw, no soons staked', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      collection: COL.TOKEN,
      uid: token.uid,
      direction: 1,
    });
    isProdSpy.mockReturnValue(true);
    await expectThrow(testEnv.wrap(voteController)({}), WenError.no_staked_soon.key);
    isProdSpy.mockRestore();
  });

  const validateStats = async (upvotes: number, downvotes: number, diff: number) => {
    await wait(async () => {
      const statsDocRef = admin
        .firestore()
        .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.STATS}/${token.uid}`);
      const stats = <TokenStats | undefined>(await statsDocRef.get()).data();
      return (
        stats?.votes?.upvotes === upvotes &&
        stats?.votes?.downvotes === downvotes &&
        stats?.votes?.voteDiff === diff
      );
    });
  };

  const sendVote = async (direction: number) => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      collection: COL.TOKEN,
      uid: token.uid,
      direction,
    });
    const vote = await testEnv.wrap(voteController)({});
    expect(vote.uid).toBe(memberAddress);
    expect(vote.parentId).toBe(token.uid);
    expect(vote.parentCol).toBe(COL.TOKEN);
    expect(vote.direction).toBe(direction);
  };

  it('Should vote', async () => {
    await sendVote(1);
    await validateStats(1, 0, 1);

    await sendVote(-1);
    await validateStats(0, 1, -1);

    mockWalletReturnValue(walletSpy, memberAddress, {
      collection: COL.TOKEN,
      uid: token.uid,
      direction: 0,
    });
    const vote = await testEnv.wrap(voteController)({});
    expect(vote).toBe(undefined);
  });
});

describe('Token rank test', () => {
  let member: string;
  let space: Space;
  let token: any;

  beforeAll(async () => {
    await createRoyaltySpaces();
  });

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    isProdSpy = jest.spyOn(config, 'isProdEnv');
    member = await createMember(walletSpy);
    space = await createSpace(walletSpy, member);
    mockWalletReturnValue(walletSpy, member, dummyToken(space.uid));
    token = await testEnv.wrap(createToken)({});
    await saveSoon();

    await admin
      .firestore()
      .doc(`${COL.SPACE}/${RANKING_TEST.tokenSpace}/${SUB_COL.GUARDIANS}/${member}`)
      .set(
        cOn({
          uid: member,
          parentId: RANKING_TEST.tokenSpace,
          parentCol: COL.SPACE,
        }),
      );
  });

  it('Should throw, no token', async () => {
    mockWalletReturnValue(walletSpy, member, {
      collection: COL.TOKEN,
      uid: wallet.getRandomEthAddress(),
      rank: 1,
    });
    await expectThrow(testEnv.wrap(rankController)({}), WenError.token_does_not_exist.key);
  });

  it('Should throw, invalid rank', async () => {
    mockWalletReturnValue(walletSpy, member, {
      collection: COL.TOKEN,
      uid: token.uid,
      rank: 200,
    });
    await expectThrow(testEnv.wrap(rankController)({}), WenError.invalid_params.key);
  });

  it('Should throw, no soons staked', async () => {
    mockWalletReturnValue(walletSpy, member, {
      collection: COL.TOKEN,
      uid: token.uid,
      rank: 1,
    });
    isProdSpy.mockReturnValue(true);
    await expectThrow(testEnv.wrap(rankController)({}), WenError.no_staked_soon.key);
    isProdSpy.mockRestore();
  });

  it('Should throw, not space member', async () => {
    await admin
      .firestore()
      .doc(`${COL.SPACE}/${RANKING_TEST.tokenSpace}/${SUB_COL.GUARDIANS}/${member}`)
      .delete();

    mockWalletReturnValue(walletSpy, member, {
      collection: COL.TOKEN,
      uid: token.uid,
      rank: 1,
    });
    await expectThrow(testEnv.wrap(rankController)({}), WenError.you_are_not_guardian_of_space.key);
  });

  const validateStats = async (count: number, sum: number) => {
    await wait(async () => {
      const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
      const statsDocRef = tokenDocRef.collection(SUB_COL.STATS).doc(token.uid);
      const stats = <TokenStats | undefined>(await statsDocRef.get()).data();
      const statsAreCorrect = stats?.ranks?.count === count && stats?.ranks?.sum === sum;

      token = <Token>(await tokenDocRef.get()).data();
      return statsAreCorrect && token.rankCount === count && token.rankSum === sum;
    });
  };

  const sendRank = async (rankValue: number) => {
    mockWalletReturnValue(walletSpy, member, {
      collection: COL.TOKEN,
      uid: token.uid,
      rank: rankValue,
    });
    const rank = await testEnv.wrap(rankController)({});
    expect(rank.uid).toBe(member);
    expect(rank.parentId).toBe(token.uid);
    expect(rank.parentCol).toBe(COL.TOKEN);
    expect(rank.rank).toBe(rankValue);
  };

  it('Should rank', async () => {
    await sendRank(100);
    await validateStats(1, 100);

    await sendRank(-50);
    await validateStats(1, -50);
  });
});
