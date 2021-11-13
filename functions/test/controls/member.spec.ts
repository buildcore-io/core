import { WenError } from "../../interfaces/errors";
import { WEN_FUNC } from "../../interfaces/functions";
import { createMember, updateMember } from '../../src/controls/member.control';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../../test/set-up';

describe('MemberController: ' + WEN_FUNC.cMemberNotExists, () => {
  it('successfully create member', async () => {
    const dummyAddress = wallet.getRandomEthAddress();
    const walletSpy = jest.spyOn(wallet, 'decodeToken');
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: {}
    }));

    const wrapped: any = testEnv.wrap(createMember);
    const returns = await wrapped();
    expect(returns?.uid).toEqual(dummyAddress.toLowerCase());
    expect(returns?.createdOn).toBeDefined();
    expect(returns?.updatedOn).toBeDefined();
    walletSpy.mockRestore();
  });

  it('successfully create member with name', async () => {
    const dummyAddress = wallet.getRandomEthAddress();
    const walletSpy = jest.spyOn(wallet, 'decodeToken');
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: {
        name: 'John',
        about: 'He rocks'
      }
    }));

    const wrapped: any = testEnv.wrap(createMember);
    const returns = await wrapped();
    expect(returns?.uid).toEqual(dummyAddress.toLowerCase());
    expect(returns?.name).toEqual('John');
    expect(returns?.about).toEqual('He rocks');
    expect(returns?.createdOn).toBeDefined();
    expect(returns?.updatedOn).toBeDefined();
    walletSpy.mockRestore();
  });

  it('unable to decode token.', async () => {
    const wrapped: any = testEnv.wrap(createMember);
    (<any>expect(wrapped())).rejects.toThrowError(WenError.token_must_be_provided.key);
  });
});


describe('MemberController: ' + WEN_FUNC.uMember, () => {
  let walletSpy: any;
  let dummyAddress: any;
  let doc: any;

  beforeEach(async () => {
    dummyAddress = wallet.getRandomEthAddress();
    walletSpy = jest.spyOn(wallet, 'decodeToken');
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: {}
    }));

    const wCreate: any = testEnv.wrap(createMember);
    doc = await wCreate();
    expect(doc?.uid).toEqual(dummyAddress.toLowerCase());
  });

  it('successfully update member', async () => {
    // Let's go ahead and update the member.
    const wUpdate: any = testEnv.wrap(updateMember);
    const updateParams = {
      uid: dummyAddress,
      name: 'abc',
      about: 'He rocks',
      linkedin: 'https://abc1.com',
      twitter: 'https://abc1.com',
      github: 'https://abc1.com'
    };
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: updateParams
    }));
    const doc2: any = await wUpdate();
    expect(doc2?.name).toEqual(updateParams.name);
    expect(doc2?.about).toEqual('He rocks');
    expect(doc2?.linkedin).toEqual(updateParams.linkedin);
    expect(doc2?.twitter).toEqual(updateParams.twitter);
    expect(doc2?.github).toEqual(updateParams.github);

    walletSpy.mockRestore();
  });

  it('unset linkedin', async () => {
    // Let's go ahead and update the member.
    const wUpdate: any = testEnv.wrap(updateMember);
    const updateParams = {
      uid: dummyAddress,
      linkedin: undefined
    };
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: updateParams
    }));
    const doc2: any = await wUpdate();
    expect(doc2?.linkedin).toEqual(null);
    walletSpy.mockRestore();
  });
});
