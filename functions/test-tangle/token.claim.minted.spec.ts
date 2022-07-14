/* eslint-disable @typescript-eslint/no-explicit-any */

import { BASIC_OUTPUT_TYPE, IBasicOutput, ITransactionPayload, SingleNodeClient, TIMELOCK_UNLOCK_CONDITION_TYPE } from '@iota/iota.js-next';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { MIN_IOTA_AMOUNT } from '../interfaces/config';
import { WenError } from '../interfaces/errors';
import { Network, Space, TransactionType } from '../interfaces/models';
import { COL, SUB_COL } from '../interfaces/models/base';
import { Token, TokenDistribution, TokenStatus } from '../interfaces/models/token';
import admin from '../src/admin.config';
import { createMember } from '../src/controls/member.control';
import { claimMintedTokenOrder, mintTokenOrder } from '../src/controls/token-mint.controller';
import { MnemonicService } from '../src/services/wallet/mnemonic';
import { AddressDetails, WalletService } from '../src/services/wallet/wallet';
import { dateToTimestamp, serverTime } from '../src/utils/dateTime.utils';
import * as wallet from '../src/utils/wallet.utils';
import { createSpace, expectThrow, mockWalletReturnValue, wait } from '../test/controls/common';
import { testEnv } from '../test/set-up';
import { MilestoneListener } from './db-sync.utils';
import { requestFundsFromFaucet } from './faucet';

let walletSpy: any;
const network = Network.RMS

const sendFromGenesis = async (from: AddressDetails, to: string, amount: number) => {
  const wallet = WalletService.newWallet(network)
  await wallet.sendFromGenesis(from, to, amount, JSON.stringify({ network: 'wen' }))
}

const createAndValidateMember = async (member: string, requestTokens?: boolean) => {
  mockWalletReturnValue(walletSpy, member, {})
  await testEnv.wrap(createMember)(member);
  const wallet = WalletService.newWallet(network)
  const address = await wallet.getNewIotaAddressDetails()
  await MnemonicService.store(address.bech32, address.mnemonic, network)
  await admin.firestore().doc(`${COL.MEMBER}/${member}`).update({ [`validatedAddress.${network}`]: address.bech32 })
  requestTokens && await requestFundsFromFaucet(network, address.bech32, 10 * MIN_IOTA_AMOUNT)
  return address;
}

describe('Token minting', () => {
  let guardian: string
  let listener: MilestoneListener
  let space: Space;
  let token: any
  let address: AddressDetails
  let member: string

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    listener = new MilestoneListener(network)
  })

  beforeEach(async () => {
    member = wallet.getRandomEthAddress()
    guardian = wallet.getRandomEthAddress();
    address = await createAndValidateMember(guardian, true)
    space = await createSpace(walletSpy, guardian)
    token = await saveToken(space.uid, guardian, member)

    mockWalletReturnValue(walletSpy, guardian, { token: token.uid, targetNetwork: network })
    const order = await testEnv.wrap(mintTokenOrder)({});
    await sendFromGenesis(address, order.payload.targetAddress, order.payload.amount)

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`)
    await wait(async () => {
      const snap = await tokenDocRef.get()
      return snap.data()?.status === TokenStatus.MINTED
    })
    token = <Token>(await tokenDocRef.get()).data()
    expect(token.status).toBe(TokenStatus.MINTED)
    expect(token.mintingData?.tokenId).toBeDefined()
    expect(token.mintingData?.aliasId).toBeDefined()
    expect(token.mintingData?.blockId).toBeDefined()
  })

  it('Claim minted tokens by guardian', async () => {
    mockWalletReturnValue(walletSpy, guardian, { token: token.uid })
    const order = await testEnv.wrap(claimMintedTokenOrder)({})
    await sendFromGenesis(address, order.payload.targetAddress, order.payload.amount)

    await wait(async () => {
      const data = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian}`).get()).data()
      return data?.mintedClaimedOn !== undefined
    })

    await wait(async () => {
      const data = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data()
      return data?.mintingData?.claimedByGuardian === guardian
    })

    const data = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data()
    expect(data.mintingData?.mintedTokens).toBe(875)
  })

  it('Claim minted tokens by member', async () => {
    const memberAddress = await createAndValidateMember(member, true)
    mockWalletReturnValue(walletSpy, member, { token: token.uid })
    const order = await testEnv.wrap(claimMintedTokenOrder)({})
    await sendFromGenesis(memberAddress, order.payload.targetAddress, order.payload.amount)

    await wait(async () => {
      const data = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`).get()).data()
      return data?.mintedClaimedOn !== undefined
    })

    const data = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data()
    expect(data.mintingData?.mintedTokens).toBe(125)
    expect(data.mintingData?.claimedByGuardian).toBeUndefined()
  })

  it('Claim minted tokens by guardian and member', async () => {
    const memberAddress = await createAndValidateMember(member, true)
    mockWalletReturnValue(walletSpy, member, { token: token.uid })
    const memberOrder = await testEnv.wrap(claimMintedTokenOrder)({})
    await sendFromGenesis(memberAddress, memberOrder.payload.targetAddress, memberOrder.payload.amount)

    mockWalletReturnValue(walletSpy, guardian, { token: token.uid })
    const order = await testEnv.wrap(claimMintedTokenOrder)({})
    await sendFromGenesis(address, order.payload.targetAddress, order.payload.amount)

    await wait(async () => {
      const memberData = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`).get()).data()
      const guardianData = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian}`).get()).data()
      return memberData?.mintedClaimedOn !== undefined && guardianData?.mintedClaimedOn !== undefined
    })

    const data = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data()
    expect(data.mintingData?.mintedTokens).toBe(1000)
    expect(data.mintingData?.claimedByGuardian).toBe(guardian)
  })

  it('Claim owned, guardian owned, airdroped-vesting', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian}`).set({
      tokenOwned: 125, tokenDrops: [{
        vestingAt: dateToTimestamp(dayjs().add(1, 'd').toDate()),
        count: 125,
        uid: wallet.getRandomEthAddress()
      }]
    })

    mockWalletReturnValue(walletSpy, guardian, { token: token.uid })
    const order = await testEnv.wrap(claimMintedTokenOrder)({})
    await sendFromGenesis(address, order.payload.targetAddress, order.payload.amount)

    const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian}`)
    await wait(async () => {
      const data = <TokenDistribution>(await distributionDocRef.get()).data()
      return data?.mintedClaimedOn !== undefined && data?.mintingBlockId !== undefined
    })

    const data = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data()
    expect(data.mintingData?.mintedTokens).toBe(875)

    const distribution = <TokenDistribution>(await distributionDocRef.get()).data()
    const client = new SingleNodeClient('https://sd1.svrs.io/')
    const block = await client.block(distribution.mintingBlockId!)
    const payload = (block.payload as ITransactionPayload)
    expect(payload.essence.outputs.length).toBe(5)
    const basicOutputs = payload.essence.outputs.filter(o => o.type === BASIC_OUTPUT_TYPE)
    expect(basicOutputs.length).toBe(3)

    const outputsWithNativeTokens = basicOutputs.map(o => <IBasicOutput>o).filter(o => !isEmpty(o.nativeTokens))

    const unlocked = outputsWithNativeTokens.filter(o => o.unlockConditions.find(u => u.type === TIMELOCK_UNLOCK_CONDITION_TYPE))
    expect(unlocked.length).toBe(1)

    const vesting = outputsWithNativeTokens.filter(o => o.unlockConditions.find(u => u.type === TIMELOCK_UNLOCK_CONDITION_TYPE && dayjs().isBefore(dayjs.unix(u.unixTime))))
    expect(vesting.length).toBe(1)
  })

  it('Should credit second claim', async () => {
    mockWalletReturnValue(walletSpy, guardian, { token: token.uid })
    const order = await testEnv.wrap(claimMintedTokenOrder)({})
    const order2 = await testEnv.wrap(claimMintedTokenOrder)({})
    await sendFromGenesis(address, order.payload.targetAddress, order.payload.amount)

    await wait(async () => {
      const guardianData = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian}`).get()).data()
      return guardianData?.mintedClaimedOn !== undefined
    })

    await sendFromGenesis(address, order2.payload.targetAddress, order2.payload.amount)

    const query = admin.firestore().collection(COL.TRANSACTION)
      .where('member', '==', guardian)
      .where('type', '==', TransactionType.CREDIT)
    await wait(async () => (await query.get()).size === 1)
  })

  it('Should throw, nothing to claim, can not create order', async () => {
    mockWalletReturnValue(walletSpy, guardian, { token: token.uid })
    const order = await testEnv.wrap(claimMintedTokenOrder)({})
    await sendFromGenesis(address, order.payload.targetAddress, order.payload.amount)
    await wait(async () => {
      const guardianData = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian}`).get()).data()
      return guardianData?.mintedClaimedOn !== undefined
    })
    await expectThrow(testEnv.wrap(claimMintedTokenOrder)({}), WenError.no_tokens_to_claim.key)
  })

  afterAll(async () => {
    await listener.cancel()
  })

})

const saveToken = async (space: string, guardian: string, member: string) => {
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
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`).set({ tokenOwned: 125 })
  return token
}
