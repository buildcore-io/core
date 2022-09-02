/* eslint-disable @typescript-eslint/no-explicit-any */

import { addressBalance } from "@iota/iota.js-next";
import { MIN_IOTA_AMOUNT } from "../interfaces/config";
import { WenError } from "../interfaces/errors";
import { Member, Network, Space, TransactionType } from "../interfaces/models";
import { COL, SUB_COL } from "../interfaces/models/base";
import { Token, TokenStatus, TokenTradeOrderStatus, TokenTradeOrderType } from "../interfaces/models/token";
import admin from "../src/admin.config";
import { mintTokenOrder } from "../src/controls/token-minting/token-mint.control";
import { tradeToken } from "../src/controls/token-trading/token-trade.controller";
import { SmrWallet } from "../src/services/wallet/SmrWalletService";
import { AddressDetails, WalletService } from "../src/services/wallet/wallet";
import { getAddress } from "../src/utils/address.utils";
import { serverTime } from "../src/utils/dateTime.utils";
import * as wallet from '../src/utils/wallet.utils';
import { createMember, createSpace, expectThrow, getRandomSymbol, milestoneProcessed, mockWalletReturnValue, submitMilestoneFunc, wait } from "../test/controls/common";
import { testEnv } from "../test/set-up";
import { MilestoneListener } from "./db-sync.utils";
import { requestFundsFromFaucet } from "./faucet";

let walletSpy: any;
const network = Network.RMS
const totalSupply = 1000

const saveToken = async (space: string, guardian: string) => {
  const tokenId = wallet.getRandomEthAddress()
  const token = ({
    symbol: getRandomSymbol(),
    totalSupply,
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
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${wallet.getRandomEthAddress()}`).set({ tokenOwned: 900 })
  return token
}

describe('Token minting', () => {
  let guardian: Member
  let address: AddressDetails
  let listener: MilestoneListener
  let space: Space;
  let token: any
  let walletService: SmrWallet

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    listener = new MilestoneListener(network)
  })

  const setup = async () => {
    const guardianId = await createMember(walletSpy)
    guardian = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${guardianId}`).get()).data()
    space = await createSpace(walletSpy, guardian.uid)
    token = await saveToken(space.uid, guardian.uid)
    walletService = await WalletService.newWallet(network) as SmrWallet
    address = await walletService.getAddressDetails(getAddress(guardian, network))
  }

  it('Should mint token', async () => {
    await setup()
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, targetNetwork: network })
    const order = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(network, address.bech32, order.payload.amount)
    await walletService.send(address, order.payload.targetAddress, order.payload.amount)

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
    expect(token.mintingData?.vaultAddress).toBe(order.payload.targetAddress)
    expect(token.mintingData?.tokensInVault).toBe(900)

    await wait(async () => {
      const balance = await addressBalance(walletService.client, token.mintingData?.vaultAddress)
      return Number(Object.values(balance.nativeTokens)[0]) === 900
    })
    const guardianData = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${guardian.uid}`).get()).data()
    await wait(async () => {
      const balance = await addressBalance(walletService.client, getAddress(guardianData, network))
      return Number(Object.values(balance.nativeTokens)[0]) === 100
    })
  })

  it('Should create order, not approved but public', async () => {
    await setup()
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false, public: true })
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, targetNetwork: network })
    const order = await testEnv.wrap(mintTokenOrder)({});
    expect(order).toBeDefined()
  })

  it('Should throw, member has no valid address', async () => {
    await setup()
    await admin.firestore().doc(`${COL.MEMBER}/${guardian.uid}`).update({ validatedAddress: {} })
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, targetNetwork: network })
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
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, targetNetwork: network })
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.token_in_invalid_status.key);
  })

  it('Should throw, not approved and not public', async () => {
    await setup()
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false, public: false })
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, targetNetwork: network })
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.token_not_approved.key);
  })

  it('Should credit, already minted', async () => {
    await setup()
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, targetNetwork: network })
    const order = await testEnv.wrap(mintTokenOrder)({});
    const order2 = await testEnv.wrap(mintTokenOrder)({});

    await requestFundsFromFaucet(network, address.bech32, 2 * order.payload.amount)
    await walletService.send(address, order.payload.targetAddress, order.payload.amount)

    await wait(async () => {
      const balance = await walletService.getBalance(address.bech32)
      return balance < 2 * order.payload.amount
    })

    await walletService.send(address, order2.payload.targetAddress, order2.payload.amount)

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`)
    await wait(async () => {
      const snap = await tokenDocRef.get()
      return snap.data()?.status === TokenStatus.MINTED
    })
    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TRANSACTION).where('type', '==', TransactionType.CREDIT).where('member', '==', guardian.uid).get()
      return snap.size > 0
    })
  })

  it('Should cancel all active sales', async () => {
    await setup()
    const request = { token: token.uid, price: MIN_IOTA_AMOUNT, count: 5, type: TokenTradeOrderType.BUY }
    mockWalletReturnValue(walletSpy, guardian.uid, request);
    const order = await testEnv.wrap(tradeToken)({});
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, MIN_IOTA_AMOUNT * 5);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    await wait(async () => {
      const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY).where('owner', '==', guardian.uid).get()
      return buySnap.size === 1
    })

    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, targetNetwork: network })
    await testEnv.wrap(mintTokenOrder)({});

    await wait(async () => {
      const buySnap = await admin.firestore().collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY)
        .where('status', '==', TokenTradeOrderStatus.CANCELLED_MINTING_TOKEN)
        .where('owner', '==', guardian.uid).get()
      return buySnap.size === 1
    })
  })

  afterEach(async () => {
    await listener.cancel()
  })
})
