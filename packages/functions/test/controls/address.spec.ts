import { COL, Member, Network, WenError } from '@soonaverse/interfaces';
import { isEmpty } from 'lodash';
import admin from '../../src/admin.config';
import { validateAddress } from '../../src/runtime/firebase/address';
import { getAddress } from '../../src/utils/address.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import {
  createMember,
  createSpace,
  expectThrow,
  milestoneProcessed,
  mockWalletReturnValue,
  submitMilestoneFunc,
  validateMemberAddressFunc,
  validateSpaceAddressFunc,
  wait,
} from './common';

const waitForAddressValidation = async (id: string, col: COL) => {
  await wait(async () => {
    const doc = (await admin.firestore().doc(`${col}/${id}`).get()).data();
    return !isEmpty(getAddress(doc, Network.IOTA));
  });
};

describe('Address validation test', () => {
  let member: string;
  let space: string;
  let walletSpy: any;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    member = await createMember(walletSpy);
    await admin.firestore().doc(`${COL.MEMBER}/${member}`).update({ validatedAddress: {} });
    space = (await createSpace(walletSpy, member)).uid;
    await admin.firestore().doc(`${COL.SPACE}/${space}`).update({ validatedAddress: {} });
  });

  it('Should validate member address', async () => {
    const order = await validateMemberAddressFunc(walletSpy, member);
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);
    await waitForAddressValidation(member, COL.MEMBER);
  });

  it('Should validate space address', async () => {
    const order = await validateSpaceAddressFunc(walletSpy, member, space);
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);
    await waitForAddressValidation(space, COL.SPACE);
  });

  it('Should throw, not guardian', async () => {
    const randomMember = await createMember(walletSpy);
    mockWalletReturnValue(walletSpy, randomMember, { space });
    await expectThrow(
      testEnv.wrap(validateAddress)({}),
      WenError.you_are_not_guardian_of_space.key,
    );
  });

  it('Should throw, member does not exist', async () => {
    mockWalletReturnValue(walletSpy, wallet.getRandomEthAddress(), { space });
    await expectThrow(testEnv.wrap(validateAddress)({}), WenError.member_does_not_exists.key);
  });

  it('Should throw, space does not exist', async () => {
    mockWalletReturnValue(walletSpy, member, { space: wallet.getRandomEthAddress() });
    await expectThrow(testEnv.wrap(validateAddress)({}), WenError.space_does_not_exists.key);
  });

  it('Should replace member address', async () => {
    const validate = async () => {
      const order = await validateMemberAddressFunc(walletSpy, member);
      const milestone = await submitMilestoneFunc(
        order.payload.targetAddress,
        order.payload.amount,
      );
      await milestoneProcessed(milestone.milestone, milestone.tranId);
    };
    await validate();
    await waitForAddressValidation(member, COL.MEMBER);

    const docRef = admin.firestore().doc(`${COL.MEMBER}/${member}`);
    const memberData = <Member>(await docRef.get()).data();
    await validate();
    await wait(async () => {
      const data = <Member>(await docRef.get()).data();
      return getAddress(data, Network.IOTA) !== getAddress(memberData, Network.IOTA);
    });

    const updatedMemberData = <Member>(await docRef.get()).data();
    expect(updatedMemberData.prevValidatedAddresses?.length).toBe(1);
    expect(updatedMemberData.prevValidatedAddresses![0]).toBe(getAddress(memberData, Network.IOTA));
  });

  it('Should throw,space already has valid address', async () => {
    await admin
      .firestore()
      .doc(`${COL.SPACE}/${space}`)
      .update({ validatedAddress: { [Network.IOTA]: 'someaddress' } });
    mockWalletReturnValue(walletSpy, member, { space });
    await expectThrow(
      testEnv.wrap(validateAddress)({}),
      WenError.space_already_have_validated_address.key,
    );
  });
});
