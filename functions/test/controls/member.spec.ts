import { WenError } from "../../interfaces/errors";
import { WEN_FUNC } from "../../interfaces/functions";
import { createMember, updateMember } from '../../src/controls/member.control';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../../test/set-up';

describe('MemberController: ' + WEN_FUNC.cMemberNotExists, () => {
  it('successfully create member', async () => {
    const dummyAddress = wallet.getRandomEthAddress();
    const walletSpy = jest.spyOn(wallet, 'decodeAuth');
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: {}
    }));

    const wrapped: any = testEnv.wrap(createMember);
    const returns = await wrapped(dummyAddress);
    expect(returns?.uid).toEqual(dummyAddress.toLowerCase());
    expect(returns?.createdOn).toBeDefined();
    expect(returns?.updatedOn).toBeDefined();
    walletSpy.mockRestore();
  });

  it('address not provided', async () => {
    const wrapped: any = testEnv.wrap(createMember);
    (<any>expect(wrapped())).rejects.toThrowError(WenError.address_must_be_provided.key);
  });
});

describe('MemberController: ' + WEN_FUNC.uMember, () => {
  let walletSpy: any;
  let dummyAddress: any;
  let doc: any;

  beforeEach(async () => {
    dummyAddress = wallet.getRandomEthAddress();
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: {}
    }));

    const wCreate: any = testEnv.wrap(createMember);
    doc = await wCreate(dummyAddress);
    expect(doc?.uid).toEqual(dummyAddress.toLowerCase());
  });

  it('successfully update member', async () => {
    // Let's go ahead and update the member.
    const wUpdate: any = testEnv.wrap(updateMember);
    const updateParams = {
      uid: dummyAddress,
      name: 'abc',
      about: 'He rocks',
      discord: 'adamkun#1233',
      twitter: 'asdasd',
      github: 'asdasda'
    };
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: updateParams
    }));
    const doc2: any = await wUpdate();
    expect(doc2?.name).toEqual(updateParams.name);
    expect(doc2?.about).toEqual('He rocks');
    expect(doc2?.discord).toEqual(updateParams.discord);
    expect(doc2?.twitter).toEqual(updateParams.twitter);
    expect(doc2?.github).toEqual(updateParams.github);

    walletSpy.mockRestore();
  });

  it('fail to update member username exists already', async () => {
    // Let's go ahead and update the member.
    const wUpdate: any = testEnv.wrap(updateMember);
    const updateParams = {
      uid: dummyAddress,
      name: 'abcd',
    };

    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: updateParams
    }));
    const doc2: any = await wUpdate();
    expect(doc2?.name).toEqual(updateParams.name);

    // Create another member.
    const dummyAddress2 = wallet.getRandomEthAddress();
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress2,
      body: {}
    }));

    const wrapped: any = testEnv.wrap(createMember);
    const returns = await wrapped(dummyAddress2);
    expect(returns?.uid).toEqual(dummyAddress2.toLowerCase());

    const updateParams2 = {
      uid: dummyAddress2,
      name: 'abcd',
    };

    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress2,
      body: updateParams2
    }));
    (<any>expect(wUpdate())).rejects.toThrowError(WenError.member_username_exists.key);
    walletSpy.mockRestore();
  });

  it('unset discord', async () => {
    // Let's go ahead and update the member.
    const wUpdate: any = testEnv.wrap(updateMember);
    const updateParams = {
      uid: dummyAddress,
      discord: undefined
    };
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: updateParams
    }));
    const doc2: any = await wUpdate();
    expect(doc2?.discord).toEqual(null);
    walletSpy.mockRestore();
  });
});
