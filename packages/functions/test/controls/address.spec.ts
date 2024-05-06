import { database } from '@buildcore/database';
import {
  COL,
  Member,
  Network,
  Space,
  Transaction,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import { isEmpty } from 'lodash';
import { getAddress } from '../../src/utils/address.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { getWallet, mockWalletReturnValue, testEnv } from '../set-up';
import { expectThrow, submitMilestoneFunc, validateMemberAddressFunc, wait } from './common';

const waitForAddressValidation = async (
  id: string,
  col: COL.SPACE | COL.MEMBER,
  network = Network.RMS,
) => {
  await wait(async () => {
    const data = await database().doc(col, id).get();
    return !isEmpty(getAddress(data, network));
  });
};

describe('Address validation test', () => {
  let member: string;
  let space: Space;

  beforeEach(async () => {
    member = await testEnv.createMember();
    await database().doc(COL.MEMBER, member).update({ rmsAddress: '' });
    space = await testEnv.createSpace(member);
    await database().doc(COL.SPACE, space.uid).update({ rmsAddress: '', iotaAddress: '' });
  });

  it('Should validate member address', async () => {
    const order = await validateMemberAddressFunc(member, Network.RMS);
    await submitMilestoneFunc(order);
    await waitForAddressValidation(member, COL.MEMBER, Network.RMS);
  });

  it('Should throw, member id is address', async () => {
    const wallet = await getWallet(Network.RMS);
    const address = await wallet.getNewIotaAddressDetails();
    mockWalletReturnValue(member, { address: address.bech32 });
    const member2 = await testEnv.wrap<Member>(WEN_FUNC.createMember);
    const call = validateMemberAddressFunc(member2.uid, Network.RMS);
    await expectThrow(call, WenError.can_not_change_validated_addess.key);
  });

  it('Should validate space address', async () => {
    mockWalletReturnValue(member, { space: space.uid });
    let order = await testEnv.wrap<Transaction>(WEN_FUNC.validateAddress);
    const milestone = await submitMilestoneFunc(order);
    const proposalQuery = database().collection(COL.PROPOSAL).where('space', '==', space.uid);
    await wait(async () => {
      const snap = await proposalQuery.get();
      return snap.length > 0;
    });
    const snap = await proposalQuery.get();
    const proposal = snap[0]!;
    expect(proposal.questions[0].text).toBe("Do you want to update the space's validate address?");
    expect(proposal.questions[0].additionalInfo).toBe(
      `IOTA: ${milestone.fromAdd} (previously: None)\n`,
    );
    expect((proposal.settings.spaceUpdateData!.validatedAddress as any)![Network.IOTA]).toBe(
      milestone.fromAdd,
    );
    expect(proposal.settings.spaceUpdateData!.uid).toBe(space.uid);

    await waitForAddressValidation(space.uid, COL.SPACE, Network.IOTA);
    mockWalletReturnValue(member, { space: space.uid });
    order = await testEnv.wrap<Transaction>(WEN_FUNC.validateAddress);
    const milestone2 = await submitMilestoneFunc(order);

    await wait(async () => {
      const snap = await proposalQuery.get();
      return snap.length === 2;
    });

    await wait(async () => {
      const spaceData = await database().doc(COL.SPACE, space.uid).get();
      return getAddress(spaceData, order.network!) === milestone2.fromAdd;
    });
    const spaceData = await database().doc(COL.SPACE, space.uid).get();
    expect(spaceData?.prevValidatedAddresses).toEqual([milestone.fromAdd]);
  });

  it('Should throw, not guardian', async () => {
    const randomMember = await testEnv.createMember();
    mockWalletReturnValue(randomMember, { space: space.uid });
    const call = testEnv.wrap<Transaction>(WEN_FUNC.validateAddress);
    await expectThrow(call, WenError.you_are_not_guardian_of_space.key);
  });

  it('Should throw, member does not exist', async () => {
    await database().doc(COL.MEMBER, member).delete();
    mockWalletReturnValue(member, { space: space.uid });
    const call = testEnv.wrap<Transaction>(WEN_FUNC.validateAddress);
    await expectThrow(call, WenError.member_does_not_exists.key);
  });

  it('Should throw, space does not exist', async () => {
    mockWalletReturnValue(member, {
      network: Network.RMS,
      space: getRandomEthAddress(),
    });
    const call = testEnv.wrap<Transaction>(WEN_FUNC.validateAddress);
    await expectThrow(call, WenError.space_does_not_exists.key);
  });

  it('Should replace member address', async () => {
    const network = Network.RMS;
    const validate = async () => {
      const order = await validateMemberAddressFunc(member, network);
      await submitMilestoneFunc(order);
    };
    await validate();

    await waitForAddressValidation(member, COL.MEMBER, network);

    const docRef = database().doc(COL.MEMBER, member);
    const memberData = <Member>await docRef.get();
    await validate();
    await wait(async () => {
      const data = <Member>await docRef.get();
      return getAddress(data, network) !== getAddress(memberData, network);
    });

    const updatedMemberData = <Member>await docRef.get();
    expect(updatedMemberData.prevValidatedAddresses?.length).toBe(1);
    expect(updatedMemberData.prevValidatedAddresses![0]).toBe(getAddress(memberData, network));
  });
});
