import {
  COL,
  MIN_IOTA_AMOUNT,
  Space,
  TokenAllocation,
  TokenStatus,
  WEN_FUNC,
  WenError,
} from '@build5/interfaces';
import { soonDb } from '../../../src/firebase/firestore/soondb';
import { createToken, updateToken } from '../../../src/runtime/firebase/token/base';
import * as wallet from '../../../src/utils/wallet.utils';
import { MEDIA, testEnv } from '../../set-up';
import {
  createMember,
  createSpace,
  expectThrow,
  getRandomSymbol,
  mockWalletReturnValue,
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
    decimals: 6,
  } as any);

describe('Token controller: ' + WEN_FUNC.updateToken, () => {
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

  it('Should throw, not guardian', async () => {
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

    await soonDb().doc(`${COL.TOKEN}/${token.uid}`).update({ status: TokenStatus.CANCEL_SALE });
    await expectThrow(testEnv.wrap(updateToken)({}), WenError.token_in_invalid_status.key);

    await soonDb().doc(`${COL.TOKEN}/${token.uid}`).update({ status: TokenStatus.BASE });
    await expectThrow(testEnv.wrap(updateToken)({}), WenError.token_in_invalid_status.key);

    await soonDb().doc(`${COL.TOKEN}/${token.uid}`).update({ status: TokenStatus.AVAILABLE });
    const result = await testEnv.wrap(updateToken)({});
    expect(result.name).toBe(token.name);
  });

  it('Should throw, token minted', async () => {
    await soonDb().doc(`${COL.TOKEN}/${token.uid}`).update({ status: TokenStatus.MINTED });
    const updateData = {
      ...data,
      name: 'TokenName2',
      uid: token.uid,
      title: 'title',
    };
    mockWalletReturnValue(walletSpy, memberAddress, updateData);
    await expectThrow(testEnv.wrap(updateToken)({}), WenError.invalid_params.key);
  });
});
