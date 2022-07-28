/* eslint-disable @typescript-eslint/no-explicit-any */
import { isEmpty } from 'lodash';
import { Member, Network, Space } from '../interfaces/models';
import { COL } from '../interfaces/models/base';
import admin from '../src/admin.config';
import { createMember } from '../src/controls/member.control';
import * as wallet from '../src/utils/wallet.utils';
import { createSpace, mockWalletReturnValue, validateMemberAddressFunc, validateSpaceAddressFunc, wait } from '../test/controls/common';
import { testEnv } from '../test/set-up';
import { MilestoneListener } from './db-sync.utils';
import { requestFundsFromFaucet } from './faucet';

let walletSpy: any;

const awaitMemberAddressValidation = async (memberId: string, network: Network) => {
  const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${memberId}`)
  await wait(async () => {
    const member = <Member>(await memberDocRef.get()).data()
    return !isEmpty((member.validatedAddress || {})[network])
  })
}

const awaitSpaceAddressValidation = async (space: string, network: Network) => {
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space}`)
  await wait(async () => {
    const space = <Space>(await spaceDocRef.get()).data()
    return !isEmpty((space.validatedAddress || {})[network])
  })
}

describe('Address validation', () => {
  let memberAddress: string
  let space: string
  let listenerATOI: MilestoneListener
  let listenerRMS: MilestoneListener

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    listenerATOI = new MilestoneListener(Network.ATOI)
    listenerRMS = new MilestoneListener(Network.RMS)
    memberAddress = wallet.getRandomEthAddress();
    mockWalletReturnValue(walletSpy, memberAddress, {})
    await testEnv.wrap(createMember)(memberAddress);
  })

  const validateMemberAddress = async (network: Network) => {
    const order = await validateMemberAddressFunc(walletSpy, memberAddress, network);
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount)

    await awaitMemberAddressValidation(memberAddress, network)

    const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${memberAddress}`)
    const member = <Member>(await memberDocRef.get()).data()
    expect(member.validatedAddress![network]).toBeDefined()
  }

  it.each([Network.ATOI, Network.RMS])('Should validate member address with network', async (network: Network) => {
    await validateMemberAddress(network)
  })

  it("Should validate member address with both network", async () => {
    await validateMemberAddress(Network.ATOI)
    await validateMemberAddress(Network.RMS)
  })

  const validateSpace = async (network: Network) => {
    const order = await validateSpaceAddressFunc(walletSpy, memberAddress, space, network);
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    await awaitSpaceAddressValidation(space, network)

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space}`)
    const spaceData = <Space>(await spaceDocRef.get()).data()
    expect(spaceData.validatedAddress![network]).toBeDefined()
  }

  it.each([Network.ATOI, Network.RMS])('Should validate space address with network', async (network: Network) => {
    space = (await createSpace(walletSpy, memberAddress)).uid
    await admin.firestore().doc(`${COL.SPACE}/${space}`).update({ validatedAddress: {} })
    await validateSpace(network)
  })

  it("Should validate space address with both network", async () => {
    space = (await createSpace(walletSpy, memberAddress)).uid
    await admin.firestore().doc(`${COL.SPACE}/${space}`).update({ validatedAddress: {} })
    await validateSpace(Network.ATOI)
    await validateSpace(Network.RMS)
  })

  afterEach(async () => {
    await listenerATOI.cancel()
    await listenerRMS.cancel()
  })

})
