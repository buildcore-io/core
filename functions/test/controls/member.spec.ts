import { WEN_FUNC } from "../../interfaces/functions";
import { createMember } from '../../src/controls/member.control';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { updateMember } from './../../src/controls/member.control';

describe('MemberController: ' + WEN_FUNC.cMemberNotExists, () => {
  it('successfully create member', async () => {
    const dummyAddress = '0xETH';
    const walletSpy = jest.spyOn(wallet, 'decodeToken');
    walletSpy.mockReturnValue(Promise.resolve({
      address: '0xETH',
      body: {}
    }));

    const wrapped: any = testEnv.wrap(createMember);
    const returns = await wrapped();
    expect(returns?.uid).toEqual(dummyAddress.toLowerCase());
    expect(returns?.createdOn).toBeDefined();
    expect(returns?.updatedOn).toBeDefined();
    walletSpy.mockRestore();
  });

  it('unable to decode token.', async () => {
    const wrapped: any = testEnv.wrap(createMember);
    expect(wrapped()).rejects.toThrow(Error);
  });
});


describe('MemberController: ' + WEN_FUNC.uMember, () => {
  it('successfully update member', async () => {
    const dummyAddress = '0xETH';
    const walletSpy = jest.spyOn(wallet, 'decodeToken');
    walletSpy.mockReturnValue(Promise.resolve({
      address: '0xETH',
      body: {}
    }));

    const wCreate: any = testEnv.wrap(createMember);
    const doc = await wCreate();

    expect(doc?.uid).toEqual(dummyAddress.toLowerCase());

    // Let's go ahead and update the member.
    const wUpdate: any = testEnv.wrap(updateMember);
    const updateParams = {
      name: 'abc',
      linkedIn: 'abc1',
      twitter: 'abc2',
      facebook: 'abc3',
    };
    walletSpy.mockReturnValue(Promise.resolve({
      address: '0xETH',
      body: updateParams
    }));
    const doc2: any = await wUpdate();
    expect(doc2?.name).toEqual(updateParams.name);
    expect(doc2?.linkedIn).toEqual(updateParams.linkedIn);
    expect(doc2?.twitter).toEqual(updateParams.twitter);
    expect(doc2?.facebook).toEqual(updateParams.facebook);

    walletSpy.mockRestore();
  });
});
