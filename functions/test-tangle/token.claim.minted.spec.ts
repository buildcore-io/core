/* eslint-disable @typescript-eslint/no-explicit-any */

import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { MIN_IOTA_AMOUNT } from '../interfaces/config';
import { WenError } from '../interfaces/errors';
import { Member, Network, Space, Transaction, TransactionType } from '../interfaces/models';
import { COL, SUB_COL } from '../interfaces/models/base';
import { TokenDistribution, TokenStatus } from '../interfaces/models/token';
import admin from '../src/admin.config';
import { claimMintedTokenOrder } from '../src/controls/token-minting/claim-minted-token.control';
import { MnemonicService } from '../src/services/wallet/mnemonic';
import { SmrWallet } from '../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../src/services/wallet/wallet';
import { getAddress } from '../src/utils/address.utils';
import { waitForBlockToBeIncluded } from '../src/utils/block.utils';
import { dateToTimestamp, serverTime } from '../src/utils/dateTime.utils';
import * as wallet from '../src/utils/wallet.utils';
import { createMember, createSpace, expectThrow, mockWalletReturnValue, wait } from '../test/controls/common';
import { testEnv } from '../test/set-up';
import { MilestoneListener } from './db-sync.utils';
import { MINTED_TOKEN_ID, requestFundsFromFaucet, VAULT_MNEMONIC } from './faucet';

let walletSpy: any;
const network = Network.RMS
const walletService = WalletService.newWallet(network) as SmrWallet

describe('Token minting', () => {
  let guardian: Member
  let listener: MilestoneListener
  let space: Space;
  let token: any
  let guardianAddress: AddressDetails

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    listener = new MilestoneListener(network);

    const guardianId = await createMember(walletSpy)
    guardian = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${guardianId}`).get()).data()
    guardianAddress = await walletService.getAddressDetails(getAddress(guardian, network))
    await requestFundsFromFaucet(network, guardianAddress.bech32, 10 * MIN_IOTA_AMOUNT)

    space = await createSpace(walletSpy, guardian.uid)
    token = await saveToken(space.uid, guardian.uid)
  })

  it('Claim minted tokens by guardian', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian.uid}`).set({ tokenOwned: 1 })

    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid })
    const order = await testEnv.wrap(claimMintedTokenOrder)({})
    await walletService.send(guardianAddress, order.payload.targetAddress, order.payload.amount)

    const query = admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', guardian.uid)
    await wait(async () => {
      const snap = await query.get()
      return snap.size === 1
    })
    const billPayment = (await query.get()).docs[0].data() as Transaction
    expect(billPayment.payload.amount).toBe(order.payload.amount)
    expect(billPayment.payload.nativeToken.amount).toBe(1)
  })

  it('Claim owned and airdroped-vesting', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian.uid}`).set({
      tokenOwned: 1, tokenDrops: [{
        vestingAt: dateToTimestamp(dayjs().add(1, 'd').toDate()),
        count: 1,
        uid: wallet.getRandomEthAddress()
      }]
    })

    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid })
    const order = await testEnv.wrap(claimMintedTokenOrder)({})
    await walletService.send(guardianAddress, order.payload.targetAddress, order.payload.amount)

    const query = admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', guardian.uid)
    await wait(async () => {
      const snap = await query.get()
      return snap.size === 2
    })
    const billPayments = (await query.get()).docs.map(d => d.data() as Transaction)
    const vesting = billPayments.filter(bp => !isEmpty(bp.payload.vestingAt))[0]
    expect(vesting.payload.amount).toBe(50100)
    expect(vesting.payload.nativeToken.amount).toBe(1)

    const unlocked = billPayments.filter(bp => isEmpty(bp.payload.vestingAt))[0]
    expect(unlocked.payload.amount).toBe(order.payload.amount - 50100)
    expect(unlocked.payload.nativeToken.amount).toBe(1)
  })

  it('Should credit second claim', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian.uid}`).set({ tokenOwned: 1 })
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid })
    const order = await testEnv.wrap(claimMintedTokenOrder)({})
    const order2 = await testEnv.wrap(claimMintedTokenOrder)({})

    await requestFundsFromFaucet(network, guardianAddress.bech32, 2 * order.payload.amount)
    const blockId = await walletService.send(guardianAddress, order.payload.targetAddress, order.payload.amount)
    await waitForBlockToBeIncluded(walletService.client, blockId)
    await walletService.send(guardianAddress, order2.payload.targetAddress, order2.payload.amount)

    await wait(async () => {
      const guardianData = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian.uid}`).get()).data()
      return guardianData?.mintedClaimedOn !== undefined
    })

    const query = admin.firestore().collection(COL.TRANSACTION)
      .where('member', '==', guardian.uid)
      .where('type', '==', TransactionType.CREDIT)
    await wait(async () => (await query.get()).size === 1)
  })

  it('Should throw, nothing to claim, can not create order', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian.uid}`).set({ tokenOwned: 1 })
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid })
    const order = await testEnv.wrap(claimMintedTokenOrder)({})
    await walletService.send(guardianAddress, order.payload.targetAddress, order.payload.amount)

    await wait(async () => {
      const guardianData = <TokenDistribution>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${guardian.uid}`).get()).data()
      return guardianData?.mintedClaimedOn !== undefined
    })

    await expectThrow(testEnv.wrap(claimMintedTokenOrder)({}), WenError.no_tokens_to_claim.key)
  })

  afterEach(async () => {
    await listener.cancel()
  })

})

const saveToken = async (space: string, guardian: string) => {
  const vaultAddress = await walletService.getIotaAddressDetails(VAULT_MNEMONIC)
  await MnemonicService.store(vaultAddress.bech32, vaultAddress.mnemonic)
  const tokenId = wallet.getRandomEthAddress()
  const token = ({
    symbol: 'SOON',
    approved: true,
    updatedOn: serverTime(),
    createdOn: serverTime(),
    space,
    uid: tokenId,
    createdBy: guardian,
    name: 'MyToken',
    status: TokenStatus.MINTED,
    mintingData: {
      tokenId: MINTED_TOKEN_ID,
      network: Network.RMS,
      vaultAddress: vaultAddress.bech32
    },
    access: 0
  })
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token
}
