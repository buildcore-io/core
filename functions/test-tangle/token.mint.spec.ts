/* eslint-disable @typescript-eslint/no-explicit-any */

import { addressBalance, Bech32Helper, ED25519_ADDRESS_TYPE, IAliasOutput, IEd25519Address, IGovernorAddressUnlockCondition, IndexerPluginClient } from "@iota/iota.js-next";
import { Converter } from "@iota/util.js-next";
import { isEqual } from "lodash";
import { MIN_IOTA_AMOUNT } from "../interfaces/config";
import { WenError } from "../interfaces/errors";
import { Member, Network, Space, Transaction, TransactionMintTokenType, TransactionType } from "../interfaces/models";
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
import { awaitTransactionConfirmationsForToken } from "./common";
import { MilestoneListener } from "./db-sync.utils";
import { requestFundsFromFaucet } from "./faucet";

let walletSpy: any;
const network = Network.RMS
const totalSupply = 1500

const saveToken = async (space: string, guardian: string, member: string) => {
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
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`).set({ tokenOwned: 1000 })
  return <Token>token
}

describe('Token minting', () => {
  let guardian: Member
  let address: AddressDetails
  let listener: MilestoneListener
  let space: Space;
  let token: Token
  let walletService: SmrWallet
  let member: string

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    listener = new MilestoneListener(network)
  })

  const setup = async () => {
    const guardianId = await createMember(walletSpy)
    member = wallet.getRandomEthAddress()
    guardian = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${guardianId}`).get()).data()
    space = await createSpace(walletSpy, guardian.uid)
    token = await saveToken(space.uid, guardian.uid, member)
    walletService = await WalletService.newWallet(network) as SmrWallet
    address = await walletService.getAddressDetails(getAddress(guardian, network))
  }

  it('Should mint token', async () => {
    await setup()
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network })
    const order = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount)

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`)
    await wait(async () => {
      const snap = await tokenDocRef.get()
      return snap.data()?.status === TokenStatus.MINTED
    })

    token = <Token>(await tokenDocRef.get()).data()
    expect(token.status).toBe(TokenStatus.MINTED)
    expect(token.mintingData?.tokenId).toBeDefined()
    expect(token.mintingData?.aliasId).toBeDefined()
    expect(token.mintingData?.aliasBlockId).toBeDefined()
    expect(token.mintingData?.blockId).toBeDefined()
    expect(token.mintingData?.mintedBy).toBe(guardian.uid)
    expect(token.mintingData?.mintedOn).toBeDefined()
    expect(token.mintingData?.vaultAddress).toBe(order.payload.targetAddress)
    expect(token.mintingData?.tokensInVault).toBe(1000)

    await wait(async () => {
      const balance = await addressBalance(walletService.client, token.mintingData?.vaultAddress!)
      return Number(Object.values(balance.nativeTokens)[0]) === 1000
    })
    const guardianData = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${guardian.uid}`).get()).data()
    await wait(async () => {
      const balance = await addressBalance(walletService.client, getAddress(guardianData, network))
      return Number(Object.values(balance.nativeTokens)[0]) === 500
    })

    await wait(async () => {
      const aliasOutput = await getAliasOutput(walletService, token.mintingData?.aliasId!)
      const addresses = await getStateAndGovernorAddress(walletService, aliasOutput)
      return isEqual(addresses, [address.bech32, address.bech32])
    })

    const mintTransactions = (await admin.firestore().collection(COL.TRANSACTION)
      .where('payload.token', '==', token.uid)
      .where('type', '==', TransactionType.MINT_TOKEN)
      .get())
      .docs.map(d => <Transaction>d.data())
    const aliasTran = mintTransactions.find(t => t.payload.type === TransactionMintTokenType.MINT_ALIAS)
    expect(aliasTran?.payload?.amount).toBe(token.mintingData?.aliasStorageDeposit)
    const foundryTran = mintTransactions.find(t => t.payload.type === TransactionMintTokenType.MINT_FOUNDRY)
    expect(foundryTran?.payload?.amount)
      .toBe(token.mintingData?.foundryStorageDeposit! + token.mintingData?.vaultStorageDeposit! + token.mintingData?.guardianStorageDeposit!)
    const aliasTransferTran = mintTransactions.find(t => t.payload.type === TransactionMintTokenType.SENT_ALIAS_TO_GUARDIAN)
    expect(aliasTransferTran?.payload?.amount).toBe(token.mintingData?.aliasStorageDeposit)
  })

  it('Should create order, not approved but public', async () => {
    await setup()
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false, public: true })
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network })
    const order = await testEnv.wrap(mintTokenOrder)({});
    expect(order).toBeDefined()
  })

  it('Should throw, member has no valid address', async () => {
    await setup()
    await admin.firestore().doc(`${COL.MEMBER}/${guardian.uid}`).update({ validatedAddress: {} })
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network })
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.member_must_have_validated_address.key);
  })

  it('Should throw, not guardian', async () => {
    await setup()
    mockWalletReturnValue(walletSpy, wallet.getRandomEthAddress(), { token: token.uid, network })
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.you_are_not_guardian_of_space.key);
  })

  it('Should throw, already minted', async () => {
    await setup()
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ status: TokenStatus.MINTED })
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network })
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.token_in_invalid_status.key);
  })

  it('Should throw, not approved and not public', async () => {
    await setup()
    await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false, public: false })
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network })
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.token_not_approved.key);
  })

  it('Should credit, already minted', async () => {
    await setup()
    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network })
    const order = await testEnv.wrap(mintTokenOrder)({});
    const order2 = await testEnv.wrap(mintTokenOrder)({});

    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount)
    await requestFundsFromFaucet(network, order2.payload.targetAddress, order2.payload.amount)

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`)
    await wait(async () => {
      const snap = await tokenDocRef.get()
      return snap.data()?.status === TokenStatus.MINTED
    })
    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TRANSACTION).where('type', '==', TransactionType.CREDIT).where('member', '==', guardian.uid).get()
      return snap.size > 0
    })
    await awaitTransactionConfirmationsForToken(token.uid)
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

    mockWalletReturnValue(walletSpy, guardian.uid, { token: token.uid, network })
    const mintOrder = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(network, mintOrder.payload.targetAddress, mintOrder.payload.amount)

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`)
    await wait(async () => {
      const snap = await tokenDocRef.get()
      return snap.data()?.status === TokenStatus.MINTED
    })

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

const getAliasOutput = async (wallet: SmrWallet, aliasId: string) => {
  const indexer = new IndexerPluginClient(wallet.client)
  const response = await indexer.alias(aliasId)
  const outputResponse = await wallet.client.output(response.items[0])
  return outputResponse.output as IAliasOutput
}

const getStateAndGovernorAddress = async (wallet: SmrWallet, alias: IAliasOutput) => {
  const hrp = wallet.info.protocol.bech32Hrp
  return (alias.unlockConditions as IGovernorAddressUnlockCondition[])
    .map(uc => (uc.address as IEd25519Address).pubKeyHash)
    .map(pubHash => Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, Converter.hexToBytes(pubHash), hrp))
}
