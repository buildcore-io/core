import { build5Db } from '@build-5/database';
import {
  Access,
  COL,
  MAX_TOTAL_TOKEN_SUPPLY,
  MIN_IOTA_AMOUNT,
  NetworkAddress,
  SUB_COL,
  Space,
  Token,
  TokenAllocation,
  WEN_FUNC,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { dateToTimestamp } from '../../../src/utils/dateTime.utils';
import * as wallet from '../../../src/utils/wallet.utils';
import { MEDIA, mockWalletReturnValue, soonTokenId, testEnv } from '../../set-up';
import { expectThrow, getRandomSymbol, setProdTiers, setTestTiers } from '../common';
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
    memberAddress = await testEnv.createMember();
    space = await testEnv.createSpace(memberAddress);
    token = dummyToken(space.uid);
  });

  it('Should create token', async () => {
    mockWalletReturnValue(memberAddress, token);
    const result = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    expect(result?.uid).toBeDefined();
    expect(result.tradingDisabled).toBe(true);
    expect(result.decimals).toBe(5);
  });

  it('Should create token without space', async () => {
    delete token.space;
    mockWalletReturnValue(memberAddress, token);
    const result = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    expect(result?.uid).toBeDefined();
    expect(result.tradingDisabled).toBe(true);
    expect(result.decimals).toBe(5);
    expect(result.space).toBe('');
  });

  it('Should create token with $ prefix', async () => {
    mockWalletReturnValue(memberAddress, { ...token, symbol: '$' + token.symbol });
    const result = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    expect(result?.uid).toBeDefined();
    expect(result.tradingDisabled).toBe(true);
    expect(result.decimals).toBe(5);
  });

  it('Should throw, invalid icon url', async () => {
    mockWalletReturnValue(memberAddress, { ...token, icon: 'some-icon-url' });
    await expectThrow(testEnv.wrap(WEN_FUNC.createToken), WenError.invalid_params.key);
    mockWalletReturnValue(memberAddress, { ...token, icon: `invalid-icon-url` });
    await expectThrow(testEnv.wrap(WEN_FUNC.createToken), WenError.invalid_params.key);
  });

  it('Should create token, verify soon', async () => {
    await build5Db()
      .doc(COL.TOKEN, soonTokenId, SUB_COL.DISTRIBUTION, memberAddress)
      .upsert({ stakes_dynamic_value: 10 * MIN_IOTA_AMOUNT });
    await setProdTiers();
    mockWalletReturnValue(memberAddress, token);
    const result = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    expect(result?.uid).toBeDefined();
    await setTestTiers();
  });

  it('Should create token with max token supply', async () => {
    mockWalletReturnValue(memberAddress, { ...token, totalSupply: MAX_TOTAL_TOKEN_SUPPLY });
    const result = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    expect(result?.uid).toBeDefined();
  });

  it('Should create, one public sale', async () => {
    token.allocations = [{ title: 'name', percentage: 100, isPublicSale: true }];
    const saleStartDate = dayjs().add(8, 'day');
    token.saleStartDate = saleStartDate.toDate();
    token.saleLength = 86400000;
    token.coolDownLength = 86400000;
    token.autoProcessAt100Percent = true;
    mockWalletReturnValue(memberAddress, token);
    const result = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    token = await build5Db().doc(COL.TOKEN, result.uid).get();
    expect(token.uid).toBeDefined();
    expect(token.saleStartDate!.toDate()).toEqual(dateToTimestamp(saleStartDate, true).toDate());
    expect(token.saleLength).toBe(86400000);
    expect(token.coolDownEnd!.toDate()).toEqual(
      dateToTimestamp(dayjs(saleStartDate).add(token.saleLength + 86400000, 'ms'), true).toDate(),
    );
    expect(token.autoProcessAt100Percent).toBe(true);
  });

  it('Should create, one public sale, no cooldown period', async () => {
    token.allocations = [{ title: 'name', percentage: 100, isPublicSale: true }];
    const saleStartDate = dayjs().add(8, 'day');
    token.saleStartDate = saleStartDate.toDate();
    token.saleLength = 86400000;
    token.coolDownLength = 0;
    mockWalletReturnValue(memberAddress, token);
    const result = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    token = await build5Db().doc(COL.TOKEN, result.uid).get();
    expect(token.uid).toBeDefined();
    expect(token.saleStartDate!.toDate()).toEqual(dateToTimestamp(saleStartDate, true).toDate());
    expect(token.saleLength).toBe(86400000);
    expect(token.coolDownEnd!.toDate()).toEqual(
      dateToTimestamp(dayjs(saleStartDate).add(token.saleLength, 'ms'), true).toDate(),
    );
  });

  it('Should not allow two tokens', async () => {
    mockWalletReturnValue(memberAddress, token);
    await testEnv.wrap<Token>(WEN_FUNC.createToken);

    mockWalletReturnValue(memberAddress, dummyToken(space.uid));
    await expectThrow(
      testEnv.wrap(WEN_FUNC.createToken),
      WenError.token_already_exists_for_space.key,
    );
  });

  it('Should only allow two tokens if first rejected', async () => {
    mockWalletReturnValue(memberAddress, token);
    const cToken = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    await build5Db().doc(COL.TOKEN, cToken.uid).update({ approved: false, rejected: true });
    mockWalletReturnValue(memberAddress, dummyToken(space.uid));
    const secondToken = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    expect(secondToken.uid).toBeDefined();
  });

  it('Should throw, no name', async () => {
    delete token.name;
    mockWalletReturnValue(memberAddress, token);
    await expectThrow(
      testEnv.wrap(WEN_FUNC.createToken),
      WenError.invalid_params.key,
      '"name" is required. ',
    );
  });

  it('Should throw, no terms and conditions', async () => {
    delete token.termsAndConditions;
    mockWalletReturnValue(memberAddress, token);
    const result = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    expect(result).toBeDefined();
  });

  it('Should throw, no symbol', async () => {
    delete token.symbol;
    mockWalletReturnValue(memberAddress, token);
    await expectThrow(testEnv.wrap(WEN_FUNC.createToken), WenError.invalid_params.key);
  });

  it('Should throw, no totalSupply', async () => {
    delete token.totalSupply;
    mockWalletReturnValue(memberAddress, token);
    await expectThrow(testEnv.wrap(WEN_FUNC.createToken), WenError.invalid_params.key);
  });

  it('Should work with no allocations', async () => {
    delete token.allocations;
    mockWalletReturnValue(memberAddress, token);
    const result = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    expect(result).toBeDefined();
  });

  it('Should throw, wrong total percentage', async () => {
    token.allocations = [
      { title: 'name', percentage: 50 },
      { title: 'ccc', percentage: 40 },
    ];

    mockWalletReturnValue(memberAddress, token);
    await expectThrow(
      testEnv.wrap(WEN_FUNC.createToken),
      WenError.invalid_params.key,
      '"allocations" contains an invalid value. Allocations percentage sum must be 100',
    );
  });

  it('Should throw, more then one public sale', async () => {
    token.allocations = [
      { title: 'name', percentage: 50, isPublicSale: true },
      { title: 'ccc', percentage: 50, isPublicSale: true },
    ];
    mockWalletReturnValue(memberAddress, token);
    await expectThrow(
      testEnv.wrap(WEN_FUNC.createToken),
      WenError.invalid_params.key,
      '"allocations" contains a duplicate value. Only one public sale is allowed',
    );
  });

  it('Should throw, past start date', async () => {
    token.startDate = dayjs().subtract(1, 'd').toDate();
    mockWalletReturnValue(memberAddress, token);
    await expectThrow(testEnv.wrap(WEN_FUNC.createToken), WenError.invalid_params.key);
  });

  it('Should throw, creator is not guardian', async () => {
    const random = await testEnv.createMember();
    mockWalletReturnValue(random, token);
    await expectThrow(
      testEnv.wrap(WEN_FUNC.createToken),
      WenError.you_are_not_guardian_of_space.key,
    );
  });

  it('Should create with public sale but no date', async () => {
    const token: any = dummyToken(space.uid);
    token.allocations = [{ title: 'name', percentage: 100, isPublicSale: true }];
    mockWalletReturnValue(memberAddress, token);
    const result = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    expect(result?.uid).toBeDefined();
  });

  it('Should throw, no public sale', async () => {
    const token: any = dummyToken(space.uid);
    token.saleStartDate = dayjs().add(8, 'd').toDate();
    token.saleLength = 86400000;
    token.coolDownLength = 86400000;
    mockWalletReturnValue(memberAddress, token);
    await expectThrow(testEnv.wrap(WEN_FUNC.createToken), WenError.no_token_public_sale.key);
  });

  it('Should throw, when public sale data is incomplete', async () => {
    const token: any = dummyToken(space.uid);
    token.allocations = [{ title: 'name', percentage: 100, isPublicSale: true }];
    token.saleStartDate = dayjs().add(8, 'd').toDate();
    mockWalletReturnValue(memberAddress, token);
    await expectThrow(testEnv.wrap(WEN_FUNC.createToken), WenError.invalid_params.key);
    token.saleLength = 86400000;
    mockWalletReturnValue(memberAddress, token);
    await expectThrow(testEnv.wrap(WEN_FUNC.createToken), WenError.invalid_params.key);
    token.coolDownLength = 86400000;
    mockWalletReturnValue(memberAddress, token);
    const result = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    expect(result?.uid).toBeDefined();
  });

  it('Should throw, token symbol not unique', async () => {
    mockWalletReturnValue(memberAddress, token);
    await testEnv.wrap<Token>(WEN_FUNC.createToken);
    const space = await testEnv.createSpace(memberAddress);
    const data = dummyToken(space.uid);

    mockWalletReturnValue(memberAddress, { ...data, symbol: token.symbol });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.createToken),
      WenError.token_symbol_must_be_globally_unique.key,
    );
  });

  it('Should not throw, token symbol not unique but prev token is rejected', async () => {
    mockWalletReturnValue(memberAddress, token);
    const newToken = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    await build5Db().doc(COL.TOKEN, newToken.uid).update({ rejected: true });
    const space = await testEnv.createSpace(memberAddress);
    mockWalletReturnValue(memberAddress, {
      ...dummyToken(space.uid),
      symbol: token.symbol,
    });
    await testEnv.wrap<Token>(WEN_FUNC.createToken);
  });

  it('Should throw, space does not exist', async () => {
    token.space = wallet.getRandomEthAddress();
    mockWalletReturnValue(memberAddress, token);
    await expectThrow(
      testEnv.wrap(WEN_FUNC.createToken),
      WenError.you_are_not_guardian_of_space.key,
    );
  });

  it('Should create with short description', async () => {
    token.shortDescriptionTitle = 'shortDescriptionTitle';
    token.shortDescription = 'shortDescription';
    mockWalletReturnValue(memberAddress, token);
    const result = await testEnv.wrap<Token>(WEN_FUNC.createToken);
    expect(result.shortDescriptionTitle).toBe('shortDescriptionTitle');
    expect(result.shortDescription).toBe('shortDescription');
  });

  it('Should throw, accessAwards required if access is MEMBERS_WITH_BADGE', async () => {
    token.access = Access.MEMBERS_WITH_BADGE;
    token.accessAwards = [wallet.getRandomEthAddress()];
    mockWalletReturnValue(memberAddress, token);
    await testEnv.wrap<Token>(WEN_FUNC.createToken);
    token.accessAwards = [];
    mockWalletReturnValue(memberAddress, token);
    await expectThrow(testEnv.wrap(WEN_FUNC.createToken), WenError.invalid_params.key);
  });

  it('Should throw, accessCollections required if access is MEMBERS_WITH_NFT_FROM_COLLECTION', async () => {
    token.access = Access.MEMBERS_WITH_NFT_FROM_COLLECTION;
    token.accessCollections = [wallet.getRandomEthAddress()];
    mockWalletReturnValue(memberAddress, token);
    await testEnv.wrap<Token>(WEN_FUNC.createToken);
    token.accessCollections = [];
    mockWalletReturnValue(memberAddress, token);
    await expectThrow(testEnv.wrap(WEN_FUNC.createToken), WenError.invalid_params.key);
  });

  it('Should throw, no tokens staked', async () => {
    await setProdTiers();
    mockWalletReturnValue(memberAddress, token);
    await expectThrow(testEnv.wrap(WEN_FUNC.createToken), WenError.no_staked_soon.key);
    await setTestTiers();
  });
});
