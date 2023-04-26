import { COL, Member, Network, Space, WenError } from '@soonaverse/interfaces';
import { isEmpty } from 'lodash';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { validateAddress } from '../../src/runtime/firebase/address';
import { WalletService } from '../../src/services/wallet/wallet';
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
    const doc = await soonDb().doc(`${col}/${id}`).get<Record<string, unknown>>();
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
    await soonDb().doc(`${COL.MEMBER}/${member}`).update({ validatedAddress: {} });
    space = (await createSpace(walletSpy, member)).uid;
    await soonDb().doc(`${COL.SPACE}/${space}`).update({ validatedAddress: {} });
  });

  it('Should validate member address', async () => {
    const order = await validateMemberAddressFunc(walletSpy, member);
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);
    await waitForAddressValidation(member, COL.MEMBER);
  });

  it.each([Network.RMS, Network.SMR])(
    'Should throw, member id is address',
    async (network: Network) => {
      const wallet = await WalletService.newWallet(network);
      const address = await wallet.getNewIotaAddressDetails();
      const memberDocRef = soonDb().doc(`${COL.MEMBER}/${address.bech32}`);
      await memberDocRef.create({ uid: address.bech32 });
      await expectThrow(
        validateMemberAddressFunc(walletSpy, address.bech32, network),
        WenError.can_not_change_validated_addess.key,
      );
    },
  );

  it('Should validate space address', async () => {
    let order = await validateSpaceAddressFunc(walletSpy, member, space);
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    const proposalQuery = soonDb().collection(COL.PROPOSAL).where('space', '==', space);
    await wait(async () => {
      const snap = await proposalQuery.get();
      return snap.length > 0;
    });

    await waitForAddressValidation(space, COL.SPACE);

    order = await validateSpaceAddressFunc(walletSpy, member, space);
    const milestone2 = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone2.milestone, milestone2.tranId);

    await wait(async () => {
      const snap = await proposalQuery.get();
      return snap.length === 2;
    });

    await wait(async () => {
      const spaceData = await soonDb().doc(`${COL.SPACE}/${space}`).get<Space>();
      return getAddress(spaceData, order.network!) === milestone2.fromAdd;
    });
    const spaceData = await soonDb().doc(`${COL.SPACE}/${space}`).get<Space>();
    expect(spaceData?.prevValidatedAddresses).toEqual([milestone.fromAdd]);
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

    const docRef = soonDb().doc(`${COL.MEMBER}/${member}`);
    const memberData = <Member>await docRef.get();
    await validate();
    await wait(async () => {
      const data = <Member>await docRef.get();
      return getAddress(data, Network.IOTA) !== getAddress(memberData, Network.IOTA);
    });

    const updatedMemberData = <Member>await docRef.get();
    expect(updatedMemberData.prevValidatedAddresses?.length).toBe(1);
    expect(updatedMemberData.prevValidatedAddresses![0]).toBe(getAddress(memberData, Network.IOTA));
  });
});
