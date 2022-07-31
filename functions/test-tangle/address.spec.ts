/* eslint-disable @typescript-eslint/no-explicit-any */

import { isEmpty } from 'lodash';
import { Member, Network, Space } from '../interfaces/models';
import { COL } from '../interfaces/models/base';
import admin from '../src/admin.config';
import { AddressDetails, WalletService } from '../src/services/wallet/wallet';
import * as wallet from '../src/utils/wallet.utils';
import { createMember, createSpace, validateMemberAddressFunc, validateSpaceAddressFunc, wait } from '../test/controls/common';
import { MilestoneListener } from './db-sync.utils';
import { getSenderAddress } from './faucet';

let walletSpy: any;

const sendAmount = async (from: AddressDetails, to: string, amount: number, network: Network) => {
  const wallet = WalletService.newWallet(network)
  await wallet.send(from, to, amount)
}
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
  let member: string
  let space: string
  let listenerATOI: MilestoneListener
  let listenerRMS: MilestoneListener

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    listenerATOI = new MilestoneListener(Network.ATOI)
    listenerRMS = new MilestoneListener(Network.RMS)
    member = await createMember(walletSpy)
    await admin.firestore().doc(`${COL.MEMBER}/${member}`).update({ validatedAddress: {} })
  })

  const validateMemberAddress = async (network: Network) => {
    const order = await validateMemberAddressFunc(walletSpy, member, network);
    const senderAddress = await getSenderAddress(network, order.payload.amount)
    await sendAmount(senderAddress, order.payload.targetAddress, order.payload.amount, network);

    await awaitMemberAddressValidation(member, network)

    const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${member}`)
    const data = <Member>(await memberDocRef.get()).data()
    expect(data.validatedAddress![network]).toBeDefined()
  }

  it.each([Network.ATOI, Network.RMS])('Should validate member address with network', async (network: Network) => {
    await validateMemberAddress(network)
  })

  it("Should validate member address with both network", async () => {
    await validateMemberAddress(Network.ATOI)
    await validateMemberAddress(Network.RMS)
  })

  const validateSpace = async (network: Network) => {
    const order = await validateSpaceAddressFunc(walletSpy, member, space, network);
    const senderAddress = await getSenderAddress(network, order.payload.amount)
    await sendAmount(senderAddress, order.payload.targetAddress, order.payload.amount, network);

    await awaitSpaceAddressValidation(space, network)

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space}`)
    const spaceData = <Space>(await spaceDocRef.get()).data()
    expect(spaceData.validatedAddress![network]).toBeDefined()
  }

  it.each([Network.ATOI, Network.RMS])('Should validate space address with network', async (network: Network) => {
    space = (await createSpace(walletSpy, member)).uid
    await admin.firestore().doc(`${COL.SPACE}/${space}`).update({ validatedAddress: {} })
    await validateSpace(network)
  })

  it("Should validate space address with both network", async () => {
    space = (await createSpace(walletSpy, member)).uid
    await admin.firestore().doc(`${COL.SPACE}/${space}`).update({ validatedAddress: {} })
    await validateSpace(Network.ATOI)
    await validateSpace(Network.RMS)
  })

  afterEach(async () => {
    await listenerATOI.cancel()
    await listenerRMS.cancel()
  })

})
