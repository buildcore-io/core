import * as admin from 'firebase-admin';
import { WEN_FUNC } from "../../interfaces/functions";
import { DOCUMENTS } from "../../interfaces/models/base";
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
    await wrapped();

    const doc = await admin.firestore().collection(DOCUMENTS.MEMBER).doc(dummyAddress).get();
    expect(doc.data()?.uid).toEqual(dummyAddress.toLowerCase());
    expect(doc.data()?.createdOn).toBeDefined();
    expect(doc.data()?.updatedOn).toBeDefined();
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
    await wCreate();

    const doc = await admin.firestore().collection(DOCUMENTS.MEMBER).doc(dummyAddress).get();
    expect(doc.data()?.uid).toEqual(dummyAddress.toLowerCase());

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
    await wUpdate();

    // TODO Get this working.
    // const doc2 = await admin.firestore().collection(DOCUMENTS.MEMBER).doc(dummyAddress).get();
    // expect(doc2.data()?.name).toEqual(updateParams.name);
    // expect(doc2.data()?.linkedIn).toEqual(updateParams.linkedIn);
    // expect(doc2.data()?.twitter).toEqual(updateParams.twitter);
    // expect(doc2.data()?.facebook).toEqual(updateParams.facebook);

    walletSpy.mockRestore();
  });
});
