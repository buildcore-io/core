
import { isEmpty } from 'lodash';
import { Member, Network, Space } from '../interfaces/models';
import { COL } from '../interfaces/models/base';
import admin from '../src/admin.config';
import { createMember } from '../src/controls/member.control';
import { AddressDetails, WalletService } from '../src/services/wallet/wallet';
import * as wallet from '../src/utils/wallet.utils';
import { createSpace, mockWalletReturnValue, validateMemberAddressFunc, validateSpaceAddressFunc, wait } from '../test/controls/common';
import { testEnv } from '../test/set-up';
import { getSenderAddress } from './faucet';

let walletSpy: any;

const sendFromGenesis = async (from: AddressDetails, to: string, amount: number, network: Network) => {
  const wallet = WalletService.newWallet(network)
  await wallet.sendFromGenesis(from, to, amount, JSON.stringify({ network: 'wen' }))
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
  let memberAddress: string
  let space: string

  beforeAll(() => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
  })

  beforeEach(async () => {
    memberAddress = wallet.getRandomEthAddress();
    console.log('Member', memberAddress)
    mockWalletReturnValue(walletSpy, memberAddress, {})
    await testEnv.wrap(createMember)(memberAddress);
  })

  const validateMemberAddress = async (network: Network) => {
    const order = await validateMemberAddressFunc(walletSpy, memberAddress, network);
    const senderAddress = await getSenderAddress(network, order.payload.amount)
    await sendFromGenesis(senderAddress, order.payload.targetAddress, order.payload.amount, network);

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
    const senderAddress = await getSenderAddress(network, order.payload.amount)
    await sendFromGenesis(senderAddress, order.payload.targetAddress, order.payload.amount, network);

    await awaitSpaceAddressValidation(space, network)

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space}`)
    const spaceData = <Space>(await spaceDocRef.get()).data()
    expect(spaceData.validatedAddress![network]).toBeDefined()
  }

  it.each([Network.ATOI, Network.RMS])('Should validate space address with network', async (network: Network) => {
    space = (await createSpace(walletSpy, memberAddress)).uid
    console.log('Space', space)
    await validateSpace(network)
  })

  it("Should validate space address with both network", async () => {
    space = (await createSpace(walletSpy, memberAddress)).uid
    console.log('Space', space)
    await validateSpace(Network.ATOI)
    await validateSpace(Network.RMS)
  })

})
