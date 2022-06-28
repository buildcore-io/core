
import { MIN_IOTA_AMOUNT } from '../../interfaces/config';
import { Network, Space } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { TokenStatus } from '../../interfaces/models/token';
import admin from '../../src/admin.config';
import { createMember } from '../../src/controls/member.control';
import { mintTokenOrder } from '../../src/controls/token-mint.controller';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { requestFromFaucetIfNotEnough } from '../../test-tangle/faucet';
import { copyMilestoneTransactionsFromDev } from '../db-sync.utils';
import { testEnv } from '../set-up';
import { createSpace, mockWalletReturnValue, wait } from './common';

let walletSpy: any;
const network = Network.RMS

const sendFromGenesis = async (from: AddressDetails, to: string, amount: number) => {
  console.log('sendFromGenesis')
  const wallet = WalletService.newWallet(network)
  await wallet.sendFromGenesis(from, to, amount, JSON.stringify({ network: 'wen' }))
}

const createAndValidateMember = async (member: string, requestTokens?: boolean) => {
  console.log('createAndValidateMember', member)
  mockWalletReturnValue(walletSpy, member, {})
  await testEnv.wrap(createMember)(member);
  const wallet = WalletService.newWallet(network)
  const address = await wallet.getNewIotaAddressDetails()
  await MnemonicService.store(address.bech32, address.mnemonic, network)
  await admin.firestore().doc(`${COL.MEMBER}/${member}`).update({ [`validatedAddress.${network}`]: address.bech32 })
  requestTokens && await requestFromFaucetIfNotEnough(network, address, 10 * MIN_IOTA_AMOUNT)
  return address;
}

describe.skip('Address validation', () => {
  let guardian: string
  let unsubscribe: any
  let space: Space;
  let token: any
  let address: AddressDetails

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    unsubscribe = copyMilestoneTransactionsFromDev(network)
    guardian = wallet.getRandomEthAddress();
    address = await createAndValidateMember(guardian, true)
    space = await createSpace(walletSpy, guardian)
    token = await saveToken(space.uid, guardian)
  })

  it('Token mint test', async () => {
    mockWalletReturnValue(walletSpy, guardian, { token: token.uid, targetNetwork: network })
    const order = await testEnv.wrap(mintTokenOrder)({});
    console.log(order)
    await sendFromGenesis(address, order.payload.targetAddress, order.payload.amount)

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`)
    await wait(async () => {
      const snap = await tokenDocRef.get()
      return snap.data()?.status === TokenStatus.MINTED
    })
    expect((await tokenDocRef.get()).data()?.status).toBe(TokenStatus.MINTED)
  })

  afterAll(() => {
    unsubscribe()
  })

})

const saveToken = async (space: string, guardian: string) => {
  const tokenId = wallet.getRandomEthAddress()
  const token = ({
    symbol: 'SOON',
    totalSupply: 1000,
    approved: true,
    updatedOn: serverTime(),
    createdOn: serverTime(),
    space,
    uid: tokenId,
    createdBy: guardian,
    name: 'MyToken',
    status: TokenStatus.AVAILABLE,
    access: 0
  })
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${wallet.getRandomEthAddress()}`).set({ tokenOwned: 125 })
  return token
}
