import { build5Db } from '@build-5/database';
import {
  Access,
  Bucket,
  COL,
  MAX_TOTAL_TOKEN_SUPPLY,
  MIN_IOTA_AMOUNT,
  NetworkAddress,
  SUB_COL,
  Space,
  StakeType,
  TokenAllocation,
  WEN_FUNC,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { createToken } from '../../../src/runtime/firebase/token/base';
import { dateToTimestamp } from '../../../src/utils/dateTime.utils';
import * as wallet from '../../../src/utils/wallet.utils';
import { MEDIA, soonTokenId, testEnv } from '../../set-up';
import {
  createMember,
  createSpace,
  expectThrow,
  getRandomSymbol,
  mockWalletReturnValue,
  setProdTiers,
  setTestTiers,
} from '../common';

let walletSpy: any;

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
    decimals: 5,
  }) as any;

describe('Token controller: ' + WEN_FUNC.createToken, () => {
  let memberAddress: NetworkAddress;
  let space: Space;
  let token: any;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = await createMember(walletSpy);
    space = await createSpace(walletSpy, memberAddress);
    token = dummyToken(space.uid);
  });

  it('Should create token', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, token);
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
    expect(result.tradingDisabled).toBe(true);
    expect(result.decimals).toBe(5);
  });

  it('Should create token without space', async () => {
    delete token.space;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
    expect(result.tradingDisabled).toBe(true);
    expect(result.decimals).toBe(5);
    expect(result.space).toBe('');
  });

  it('Should create token with $ prefix', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, { ...token, symbol: '$' + token.symbol });
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
    expect(result.tradingDisabled).toBe(true);
    expect(result.decimals).toBe(5);
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
    await build5Db()
      .doc(`${COL.TOKEN}/${soonTokenId}/${SUB_COL.DISTRIBUTION}/${memberAddress}`)
      .create({
        stakes: {
          [StakeType.DYNAMIC]: {
            value: 10 * MIN_IOTA_AMOUNT,
          },
        },
      });

    mockWalletReturnValue(walletSpy, memberAddress, token);
    await setProdTiers();
    const result = await testEnv.wrap(createToken)({});
    expect(result?.uid).toBeDefined();
    await setTestTiers();
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
    await build5Db().doc(`${COL.TOKEN}/${cToken.uid}`).update({ approved: false, rejected: true });
    mockWalletReturnValue(walletSpy, memberAddress, dummyToken(space.uid));
    const secondToken = await testEnv.wrap(createToken)({});
    expect(secondToken.uid).toBeDefined();
  });

  it('Should throw, no name', async () => {
    delete token.name;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(
      testEnv.wrap(createToken)({}),
      WenError.invalid_params.key,
      'Invalid params. "name" is required. ',
    );
  });

  it('Should throw, no terms and conditions', async () => {
    delete token.termsAndConditions;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    const result = await testEnv.wrap(createToken)({});
    expect(result).toBeDefined();
  });

  it('Should throw, no symbol', async () => {
    delete token.symbol;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(testEnv.wrap(createToken)({}), WenError.invalid_params.key);
  });

  it('Should throw, no valid space address', async () => {
    space = await createSpace(walletSpy, memberAddress);
    await build5Db().doc(`${COL.SPACE}/${space.uid}`).update({ validatedAddress: {} });
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

  it('Should work with no allocations', async () => {
    delete token.allocations;
    mockWalletReturnValue(walletSpy, memberAddress, token);
    const result = await testEnv.wrap(createToken)({});
    expect(result).toBeDefined();
  });

  it('Should throw, wrong total percentage', async () => {
    token.allocations = [
      { title: 'asd', percentage: 50 },
      { title: 'ccc', percentage: 40 },
    ];
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(
      testEnv.wrap(createToken)({}),
      WenError.invalid_params.key,
      'Invalid params. "allocations" contains an invalid value. Allocations percentage sum must be 100',
    );
  });

  it('Should throw, more then one public sale', async () => {
    token.allocations = [
      { title: 'asd', percentage: 50, isPublicSale: true },
      { title: 'ccc', percentage: 50, isPublicSale: true },
    ];
    mockWalletReturnValue(walletSpy, memberAddress, token);
    await expectThrow(
      testEnv.wrap(createToken)({}),
      WenError.invalid_params.key,
      'Invalid params. "allocations" contains a duplicate value. Only one public sale is allowed',
    );
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

  it('Should not throw, token symbol not unique but prev token is rejected', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, token);
    const newToken = await testEnv.wrap(createToken)({});
    await build5Db().doc(`${COL.TOKEN}/${newToken.uid}`).update({ rejected: true });

    const space = await createSpace(walletSpy, memberAddress);
    mockWalletReturnValue(walletSpy, memberAddress, {
      ...dummyToken(space.uid),
      symbol: token.symbol,
    });
    await testEnv.wrap(createToken)({});
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
    await setProdTiers();
    await expectThrow(testEnv.wrap(createToken)({}), WenError.no_staked_soon.key);
    await setTestTiers();
  });
});
