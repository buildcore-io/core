import { WenError, WEN_FUNC } from '@soonaverse/interfaces';
import { createMember, updateMember } from '../../src/controls/member.control';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../../test/set-up';
import { expectThrow, mockWalletReturnValue } from './common';

let walletSpy: any;

describe('MemberController: ' + WEN_FUNC.cMemberNotExists, () => {
  it('successfully create member', async () => {
    const dummyAddress = wallet.getRandomEthAddress();
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    mockWalletReturnValue(walletSpy, dummyAddress, {});

    const member = await testEnv.wrap(createMember)(dummyAddress);
    expect(member?.uid).toEqual(dummyAddress.toLowerCase());
    expect(member?.createdOn).toBeDefined();
    expect(member?.updatedOn).toBeDefined();
    walletSpy.mockRestore();
  });

  it('address not provided', async () => {
    await expectThrow(testEnv.wrap(createMember)({}), WenError.address_must_be_provided.key);
  });

  it('address is too short', async () => {
    const dummyAddress = '0xdasdsadasd';
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    mockWalletReturnValue(walletSpy, dummyAddress, {});
    await expectThrow(
      testEnv.wrap(createMember)(dummyAddress),
      WenError.address_must_be_provided.key,
    );
  });

  it('address is too long', async () => {
    const dummyAddress =
      '0xdasdsadasdadasdaskljasklsdfldsflksdfhlsdfhlksdflksdflksdhflkasdasdsadasdasdasdsadsadsadsadsa' +
      'sadasdadasdaskljasklsdfldsflksdfhlsdfhlksdflksdflksdhflkasdasdsadasdasdasdsadsadsadsadsadsadsa' +
      'sadasdadasdaskljasklsdfldsflksdfhlsdfhlksdflksdflksdhflkasdasdsadasdasdasdsadsadsadsadsadsadsa' +
      'sadasdadasdaskljasklsdfldsflksdfhlsdfhlksdflksdflksdhflkasdasdsadasdasdasdsadsadsadsadsadsadsa' +
      'sadasdadasdaskljasklsdfldsflksdfhlsdfhlksdflksdflksdhflkasdasdsadasdasdasdsadsadsadsadsadsadsa';
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    mockWalletReturnValue(walletSpy, dummyAddress, {});
    await expectThrow(
      testEnv.wrap(createMember)(dummyAddress),
      WenError.address_must_be_provided.key,
    );
  });
});

describe('MemberController: ' + WEN_FUNC.uMember, () => {
  let dummyAddress: any;
  let doc: any;

  beforeEach(async () => {
    dummyAddress = wallet.getRandomEthAddress();
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    mockWalletReturnValue(walletSpy, dummyAddress, {});
    doc = await testEnv.wrap(createMember)(dummyAddress);
    expect(doc?.uid).toEqual(dummyAddress.toLowerCase());
  });

  it('successfully update member', async () => {
    const updateParams = {
      uid: dummyAddress,
      name: wallet.getRandomEthAddress(),
      about: 'He rocks',
      discord: 'adamkun#1233',
      twitter: 'asdasd',
      github: 'asdasda',
    };
    mockWalletReturnValue(walletSpy, dummyAddress, updateParams);
    const uMember: any = await testEnv.wrap(updateMember)({});
    expect(uMember?.name).toEqual(updateParams.name);
    expect(uMember?.about).toEqual('He rocks');
    expect(uMember?.discord).toEqual(updateParams.discord);
    expect(uMember?.twitter).toEqual(updateParams.twitter);
    expect(uMember?.github).toEqual(updateParams.github);
    walletSpy.mockRestore();
  });

  it('fail to update member username exists already', async () => {
    const updateParams = { uid: dummyAddress, name: 'abcd' + Math.floor(Math.random() * 1000) };
    mockWalletReturnValue(walletSpy, dummyAddress, updateParams);
    const uMember = await testEnv.wrap(updateMember)({});
    expect(uMember?.name).toEqual(updateParams.name);

    const dummyAddress2 = wallet.getRandomEthAddress();
    mockWalletReturnValue(walletSpy, dummyAddress2, {});
    const cMember = await testEnv.wrap(createMember)(dummyAddress2);
    expect(cMember?.uid).toEqual(dummyAddress2.toLowerCase());

    mockWalletReturnValue(walletSpy, dummyAddress2, {
      uid: dummyAddress2,
      name: updateParams.name,
    });
    await expectThrow(testEnv.wrap(updateMember)({}), WenError.member_username_exists.key);
  });

  it('unset discord', async () => {
    const updateParams = { uid: dummyAddress, discord: undefined };
    mockWalletReturnValue(walletSpy, dummyAddress, updateParams);
    const uMember = await testEnv.wrap(updateMember)({});
    expect(uMember?.discord).toEqual(null);
    walletSpy.mockRestore();
  });
});
