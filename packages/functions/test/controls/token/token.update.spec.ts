import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  NetworkAddress,
  Space,
  Token,
  TokenAllocation,
  TokenStatus,
  WEN_FUNC,
  WenError,
} from '@build-5/interfaces';
import { MEDIA, mockWalletReturnValue, testEnv } from '../../set-up';
import { expectThrow, getRandomSymbol } from '../common';
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
    decimals: 6,
  }) as any;

describe('Token controller: ' + WEN_FUNC.updateToken, () => {
  let memberAddress: NetworkAddress;
  let space: Space;
  let token: Token;
  const data = {
    shortDescriptionTitle: undefined,
    shortDescription: undefined,
    name: undefined,
    uid: undefined,
    title: undefined,
    description: undefined,
  };
  beforeEach(async () => {
    memberAddress = await testEnv.createMember();
    space = await testEnv.createSpace(memberAddress);
    mockWalletReturnValue(memberAddress, dummyToken(space.uid));
    token = await testEnv.wrap<Token>(WEN_FUNC.createToken);
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
    mockWalletReturnValue(memberAddress, updateData);
    const result = await testEnv.wrap<Token>(WEN_FUNC.updateToken);
    expect(result.name).toBe(updateData.name);
    expect(result.title).toBe(updateData.title);
    expect(result.description).toBe(updateData.description);
    expect(result.pricePerToken).toBe(updateData.pricePerToken);
  });

  it('Should update token, no space', async () => {
    await build5Db().doc(COL.TOKEN, token.uid).update({ space: '' });
    const updateData = {
      ...data,
      name: 'TokenName2',
      uid: token.uid,
      title: 'title',
      description: 'description',
      pricePerToken: 2 * MIN_IOTA_AMOUNT,
    };
    const random = await testEnv.createMember();

    mockWalletReturnValue(random, updateData);
    await expectThrow(
      testEnv.wrap<Token>(WEN_FUNC.updateToken),
      WenError.you_must_be_the_creator_of_this_token.key,
    );
    mockWalletReturnValue(memberAddress, updateData);
    const result = await testEnv.wrap<Token>(WEN_FUNC.updateToken);
    expect(result.name).toBe(updateData.name);
    expect(result.title).toBe(updateData.title);
    expect(result.description).toBe(updateData.description);
    expect(result.pricePerToken).toBe(updateData.pricePerToken);
  });

  it('Should update token - remove description', async () => {
    const updateData = { ...data, name: token.name, uid: token.uid, title: 'title2' };
    mockWalletReturnValue(memberAddress, updateData);
    const result = await testEnv.wrap<Token>(WEN_FUNC.updateToken);
    token = (await build5Db().doc(COL.TOKEN, result.uid).get())!;
    expect(token.name).toBe(token.name);
    expect(token.title).toBe(updateData.title);
    expect(token.description).toBe(updateData.description);
  });

  it('Should throw, not owner', async () => {
    const updateData = {
      ...data,
      name: 'TokenName2',
      uid: token.uid,
      title: 'title',
      description: 'description',
    };
    const random = await testEnv.createMember();

    mockWalletReturnValue(random, updateData);
    await expectThrow(
      testEnv.wrap<Token>(WEN_FUNC.updateToken),
      WenError.you_are_not_guardian_of_space.key,
    );
  });

  it('Should throw, not guardian', async () => {
    const updateData = {
      ...data,
      name: 'TokenName2',
      uid: token.uid,
      title: 'title',
      description: 'description',
    };
    const random = await testEnv.createMember();
    mockWalletReturnValue(random, updateData);
    await expectThrow(
      testEnv.wrap<Token>(WEN_FUNC.updateToken),
      WenError.you_are_not_guardian_of_space.key,
    );
  });

  it('Should update short description', async () => {
    const updateData = { ...data, name: token.name, uid: token.uid, title: 'title2' };

    await build5Db().doc(COL.TOKEN, token.uid).update({ status: TokenStatus.BASE });
    mockWalletReturnValue(memberAddress, updateData);
    await expectThrow(
      testEnv.wrap<Token>(WEN_FUNC.updateToken),
      WenError.token_in_invalid_status.key,
    );
    await build5Db().doc(COL.TOKEN, token.uid).update({ status: TokenStatus.AVAILABLE });
    mockWalletReturnValue(memberAddress, updateData);
    const result = await testEnv.wrap<Token>(WEN_FUNC.updateToken);
    expect(result.name).toBe(token.name);
  });

  it('Should throw, token minted', async () => {
    await build5Db().doc(COL.TOKEN, token.uid).update({ status: TokenStatus.MINTED });
    const updateData = { ...data, name: 'TokenName2', uid: token.uid, title: 'title' };
    mockWalletReturnValue(memberAddress, updateData);
    await expectThrow(testEnv.wrap<Token>(WEN_FUNC.updateToken), WenError.invalid_params.key);
  });
});
