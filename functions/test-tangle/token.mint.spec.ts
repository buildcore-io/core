/* eslint-disable @typescript-eslint/no-explicit-any */

import { MIN_IOTA_AMOUNT } from "../interfaces/config";
import { WenError } from "../interfaces/errors";
import { Network, Space, TransactionType } from "../interfaces/models";
import { COL, SUB_COL } from "../interfaces/models/base";
import { Token, TokenStatus, TokenTradeOrderStatus, TokenTradeOrderType } from "../interfaces/models/token";
import admin from "../src/admin.config";
import { createMember } from "../src/controls/member.control";
import { mintTokenOrder } from "../src/controls/token-mint.controller";
import { buyToken } from "../src/controls/token-trading/token-buy.controller";
import { MnemonicService } from "../src/services/wallet/mnemonic";
import { AddressDetails, WalletService } from "../src/services/wallet/wallet";
import { serverTime } from "../src/utils/dateTime.utils";
import * as wallet from '../src/utils/wallet.utils';
import { createSpace, expectThrow, milestoneProcessed, mockWalletReturnValue, submitMilestoneFunc, wait } from "../test/controls/common";
import { testEnv } from "../test/set-up";
import { MilestoneListener } from "./db-sync.utils";
import { requestFundsFromFaucet } from "./faucet";

let walletSpy: any;
const network = Network.RMS

const sendAmountWithWallet = async (from: AddressDetails, to: string, amount: number) => {
  const wallet = WalletService.newWallet(network)
  await wallet.send(from, to, amount)
}

const createAndValidateMember = async (member: string, requestTokens?: boolean) => {
  mockWalletReturnValue(walletSpy, member, {})
  await testEnv.wrap(createMember)(member);
  const wallet = WalletService.newWallet(network)
  const iotaWallet = WalletService.newWallet(Network.IOTA)
  const address = await wallet.getNewIotaAddressDetails()
  await MnemonicService.store(address.bech32, address.mnemonic, network)
  await admin.firestore().doc(`${COL.MEMBER}/${member}`).update({
    [`validatedAddress.${network}`]: address.bech32,
    [`validatedAddress.${Network.IOTA}`]: (await iotaWallet.getNewIotaAddressDetails()).bech32
  })
  requestTokens && await requestFundsFromFaucet(network, address.bech32, 10 * MIN_IOTA_AMOUNT)
  return address;
}

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

describe('Token minting', () => {
  let guardian: string
  let listener: MilestoneListener
  let space: Space;
  let token: any
  let address: AddressDetails

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    listener = new MilestoneListener(network)
  })

  const setup = async (requestTokens?: boolean) => {
    guardian = wallet.getRandomEthAddress();
    address = await createAndValidateMember(guardian, requestTokens)
    space = await createSpace(walletSpy, guardian)
    token = await saveToken(space.uid, guardian)
  }

  it('Should mint token', async () => {
    await setup(true)
    mockWalletReturnValue(walletSpy, guardian, { token: token.uid, targetNetwork: network })
    const order = await testEnv.wrap(mintTokenOrder)({});
    await sendAmountWithWallet(address, order.payload.targetAddress, order.payload.amount)

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
    expect(token.mintingData?.orderTranId).toBe(order.uid)
  })

  it('Should throw, member has no valid address', async () => {
    await setup()
    await admin.firestore().doc(`${COL.MEMBER}/${guardian}`).update({ validatedAddress: {} })
    mockWalletReturnValue(walletSpy, guardian, { token: token.uid, targetNetwork: network })
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.member_must_have_validated_address.key);
  })

  it('Should throw, not guardian', async () => {
    await setup()
    mockWalletReturnValue(walletSpy, wallet.getRandomEthAddress(), { token: token.uid, targetNetwork: network })
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.you_are_not_guardian_of_space.key);
  })

  it('Should throw, already minted', async () => {
    await setup()
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ status: TokenStatus.MINTED })
    mockWalletReturnValue(walletSpy, guardian, { token: token.uid, targetNetwork: network })
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.token_in_invalid_status.key);
  })

  it('Should cretid, already minted', async () => {
    await setup(true)
    mockWalletReturnValue(walletSpy, guardian, { token: token.uid, targetNetwork: network })
    const order = await testEnv.wrap(mintTokenOrder)({});
    await sendAmountWithWallet(address, order.payload.targetAddress, order.payload.amount)

    const wallet = WalletService.newWallet(network)
    await wait(async () => {
      const balance = await wallet.getBalance(address.bech32)
      return balance < 10 * MIN_IOTA_AMOUNT
    })
    const order2 = await testEnv.wrap(mintTokenOrder)({});
    await sendAmountWithWallet(address, order2.payload.targetAddress, order2.payload.amount)

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`)
    await wait(async () => {
      const snap = await tokenDocRef.get()
      return snap.data()?.status === TokenStatus.MINTED
    })
    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TRANSACTION).where('type', '==', TransactionType.CREDIT).where('member', '==', guardian).get()
      return snap.size > 0
    })
  })

  it('Should cancel all active sales', async () => {
    await setup()
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5 }
    mockWalletReturnValue(walletSpy, guardian, request);
    const order = await testEnv.wrap(buyToken)({});
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, MIN_IOTA_AMOUNT * 5);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    await wait(async () => {
      const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY).where('owner', '==', guardian).get()
      return buySnap.size === 1
    })

    mockWalletReturnValue(walletSpy, guardian, { token: token.uid, targetNetwork: network })
    await testEnv.wrap(mintTokenOrder)({});

    await wait(async () => {
      const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY)
        .where('status', '==', TokenTradeOrderStatus.CANCELLED_MINTING_TOKEN)
        .where('owner', '==', guardian).get()
      return buySnap.size === 1
    })
  })

  afterEach(async () => {
    await listener.cancel()
  })
})
