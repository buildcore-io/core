import { WenError } from "../../interfaces/errors";
import { Member, Network, Space } from "../../interfaces/models";
import { COL } from "../../interfaces/models/base";
import admin from "../../src/admin.config";
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, expectThrow, milestoneProcessed, submitMilestoneFunc, validateMemberAddressFunc, validateSpaceAddressFunc } from "./common";

let walletSpy: any;

describe('Address validation', () => {

  beforeAll(() => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
  })

  it('Should validate member address', async () => {
    const memberAddress = await createMember(walletSpy, true)
    const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${memberAddress}`).get()).data()
    expect(member.validatedAddress?.iota).toBeDefined()
  })

  it('Should validate member address with shimmer', async () => {
    const memberAddress = await createMember(walletSpy, true, Network.SHIMMER)
    const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${memberAddress}`).get()).data()
    expect(member.validatedAddress?.smr).toBeDefined()
  })

  it('Should validate member address with both', async () => {
    const memberAddress = await createMember(walletSpy, true)

    const memberValidation = await validateMemberAddressFunc(walletSpy, memberAddress, Network.SHIMMER);
    const milestone = await submitMilestoneFunc(memberValidation.payload.targetAddress, memberValidation.payload.amount, Network.SHIMMER);
    await milestoneProcessed(milestone.milestone, milestone.tranId, Network.SHIMMER);

    const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${memberAddress}`).get()).data()
    expect(member.validatedAddress?.iota).toBeDefined()
    expect(member.validatedAddress?.smr).toBeDefined()
  })

  it('Should validate space address', async () => {
    const memberAddress = await createMember(walletSpy)
    const space = await createSpace(walletSpy, memberAddress, true)
    expect(space.validatedAddress?.iota).toBeDefined()
  })

  it('Should validate space address with shimmer', async () => {
    const memberAddress = await createMember(walletSpy)
    const space = await createSpace(walletSpy, memberAddress, true, Network.SHIMMER)
    expect(space.validatedAddress?.smr).toBeDefined()
  })

  it('Should validate space address with both', async () => {
    const memberAddress = await createMember(walletSpy, true)
    const space = await createSpace(walletSpy, memberAddress, true)

    const spaceValidation = await validateSpaceAddressFunc(walletSpy, memberAddress, space.uid, Network.SHIMMER);
    const nextMilestone = await submitMilestoneFunc(spaceValidation.payload.targetAddress, spaceValidation.payload.amount, Network.SHIMMER);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId, Network.SHIMMER);

    const spaceData = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).get()).data()
    expect(spaceData.validatedAddress?.iota).toBeDefined()
    expect(spaceData.validatedAddress?.smr).toBeDefined()
  })

  it('Should throw, can not validate twice', async () => {
    const memberAddress = await createMember(walletSpy, true)
    const space = await createSpace(walletSpy, memberAddress, true)
    await expectThrow(validateSpaceAddressFunc(walletSpy, memberAddress, space.uid, Network.IOTA), WenError.space_already_have_validated_address.key);
  })

})
