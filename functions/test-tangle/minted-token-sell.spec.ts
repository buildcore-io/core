/* eslint-disable @typescript-eslint/no-explicit-any */

import { addressBalance } from '@iota/iota.js-next';
import { HexHelper } from '@iota/util.js-next';
import bigInt from 'big-integer';
import { isEmpty } from 'lodash';
import { MIN_IOTA_AMOUNT } from '../interfaces/config';
import { Network, Space } from '../interfaces/models';
import { COL, SUB_COL } from '../interfaces/models/base';
import { Token, TokenBuySellOrder, TokenDistribution, TokenStatus } from '../interfaces/models/token';
import admin from '../src/admin.config';
import { createMember } from '../src/controls/member.control';
import { claimMintedTokenOrder, mintTokenOrder } from '../src/controls/token-mint.controller';
import { sellMintedTokenOrder } from '../src/controls/token-sale/minted-token-sell.controller';
import { buyToken, cancelBuyOrSell } from '../src/controls/token-sale/token-buy.controller';
import { MnemonicService } from '../src/services/wallet/mnemonic';
import { SmrWallet } from '../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../src/services/wallet/wallet';
import { serverTime } from '../src/utils/dateTime.utils';
import * as wallet from '../src/utils/wallet.utils';
import { createRoyaltySpaces, createSpace, mockWalletReturnValue, wait } from '../test/controls/common';
import { testEnv } from '../test/set-up';
import { MilestoneListener } from './db-sync.utils';
import { requestFundsFromFaucet } from './faucet';

let walletSpy: any;
const network = Network.RMS

const sendFromGenesis = async (from: AddressDetails, to: string, amount: number) => {
  const wallet = WalletService.newWallet(network)
  await wallet.sendFromGenesis(from, to, amount, JSON.stringify({ network: 'wen' }))
}

const createAndValidateMember = async (member: string, requestTokens = 0) => {
  mockWalletReturnValue(walletSpy, member, {})
  await testEnv.wrap(createMember)(member);
  const wallet = WalletService.newWallet(network)
  const address = await wallet.getNewIotaAddressDetails()
  await MnemonicService.store(address.bech32, address.mnemonic, network)
  await admin.firestore().doc(`${COL.MEMBER}/${member}`).update({ [`validatedAddress.${network}`]: address.bech32 })
  requestTokens && await requestFundsFromFaucet(network, address.bech32, requestTokens * MIN_IOTA_AMOUNT)
  return address;
}

describe('Token minting', () => {
  let seller: string
  let listener: MilestoneListener
  let space: Space;
  let token: Token
  let sellerAddress: AddressDetails
  let buyer: string
  let buyerAddress: AddressDetails

  beforeAll(async () => {
    await createRoyaltySpaces(Network.RMS)
  })

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    listener = new MilestoneListener(network)
    seller = wallet.getRandomEthAddress();
    sellerAddress = await createAndValidateMember(seller, 10)
    space = await createSpace(walletSpy, seller)
    token = await saveToken(space.uid, seller)

    buyer = wallet.getRandomEthAddress()
    buyerAddress = await createAndValidateMember(buyer, 20)

    mockWalletReturnValue(walletSpy, seller, { token: token.uid, targetNetwork: network })
    const order = await testEnv.wrap(mintTokenOrder)({});
    await sendFromGenesis(sellerAddress, order.payload.targetAddress, order.payload.amount)

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

    mockWalletReturnValue(walletSpy, seller, { token: token.uid })
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({})
    await sendFromGenesis(sellerAddress, claimOrder.payload.targetAddress, claimOrder.payload.amount)

    const distributionDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${seller}`)
    await wait(async () => {
      const data = <TokenDistribution>(await distributionDocRef.get()).data()
      return data?.mintedClaimedOn !== undefined && data?.mintingBlockId !== undefined
    })

    const data = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data()
    expect(data.mintingData?.mintedTokens).toBe(1000)

    const walletService = WalletService.newWallet(network) as SmrWallet
    await wait(async () => {
      const balance = await addressBalance(walletService.client, sellerAddress.bech32)
      return !isEmpty(balance.nativeTokens)
    })
  })

  it('Fulfill sell with same price', async () => {
    const wallet = WalletService.newWallet(network) as SmrWallet

    mockWalletReturnValue(walletSpy, seller, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT })
    const sellOrder = await testEnv.wrap(sellMintedTokenOrder)({})
    await wallet.send(sellerAddress, sellOrder.payload.targetAddress, 0, { amount: HexHelper.fromBigInt256(bigInt(10)), id: token.mintingData?.tokenId! })

    mockWalletReturnValue(walletSpy, buyer, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT })
    const buyOrder = await testEnv.wrap(buyToken)({})
    await wallet.send(buyerAddress, buyOrder.payload.targetAddress, 10 * MIN_IOTA_AMOUNT)

    await wait(async () => {
      const balance = await addressBalance(wallet.client, buyerAddress.bech32)
      return Number(Object.values(balance.nativeTokens)[0]) === 10
    })

    await wait(async () => {
      const balance = await addressBalance(wallet.client, sellerAddress.bech32)
      return Number(Object.values(balance.nativeTokens)[0]) === 990
    })
  })

  it('Fulfill buy with half price', async () => {
    const wallet = WalletService.newWallet(network) as SmrWallet

    mockWalletReturnValue(walletSpy, seller, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT })
    const sellOrder = await testEnv.wrap(sellMintedTokenOrder)({})
    await wallet.send(sellerAddress, sellOrder.payload.targetAddress, 0, { amount: HexHelper.fromBigInt256(bigInt(10)), id: token.mintingData?.tokenId! })

    mockWalletReturnValue(walletSpy, buyer, { token: token.uid, count: 10, price: 2 * MIN_IOTA_AMOUNT })
    const buyOrder = await testEnv.wrap(buyToken)({})
    await wallet.send(buyerAddress, buyOrder.payload.targetAddress, 10 * 2 * MIN_IOTA_AMOUNT)

    await wait(async () => {
      const balance = await addressBalance(wallet.client, buyerAddress.bech32)
      return Number(Object.values(balance.nativeTokens)[0]) === 10
    })

    await wait(async () => {
      const balance = await addressBalance(wallet.client, sellerAddress.bech32)
      return Number(Object.values(balance.nativeTokens)[0]) === 990
    })
  })

  it('Create and cancel sell', async () => {
    const wallet = WalletService.newWallet(network) as SmrWallet

    mockWalletReturnValue(walletSpy, seller, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT })
    const sellOrder = await testEnv.wrap(sellMintedTokenOrder)({})
    await wallet.send(sellerAddress, sellOrder.payload.targetAddress, 0, { amount: HexHelper.fromBigInt256(bigInt(10)), id: token.mintingData?.tokenId! })
    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller)
    await wait(async () => {
      const snap = await query.get()
      return snap.size !== 0
    })
    const sell = <TokenBuySellOrder>(await query.get()).docs[0].data()
    const cancelRequest = { uid: sell.uid }
    mockWalletReturnValue(walletSpy, seller, cancelRequest);
    await testEnv.wrap(cancelBuyOrSell)({});

    await wait(async () => {
      const balance = await addressBalance(wallet.client, sellerAddress.bech32)
      return Number(Object.values(balance.nativeTokens)[0]) === 1000
    })
  })

  it('Create and cancel buy', async () => {
    const wallet = WalletService.newWallet(network) as SmrWallet

    mockWalletReturnValue(walletSpy, buyer, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT })
    const buyOrder = await testEnv.wrap(buyToken)({})
    await wallet.send(buyerAddress, buyOrder.payload.targetAddress, 10 * MIN_IOTA_AMOUNT)

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer)
    await wait(async () => {
      const snap = await query.get()
      return snap.size !== 0
    })

    const buy = <TokenBuySellOrder>(await query.get()).docs[0].data()
    const cancelRequest = { uid: buy.uid }
    mockWalletReturnValue(walletSpy, buyer, cancelRequest);
    await testEnv.wrap(cancelBuyOrSell)({});

    await wait(async () => {
      const balance = await addressBalance(wallet.client, buyerAddress.bech32)
      return Number(balance.balance) === 20 * MIN_IOTA_AMOUNT
    })
  })

  it('Half fulfill buy and cancel it', async () => {
    const wallet = WalletService.newWallet(network) as SmrWallet

    mockWalletReturnValue(walletSpy, seller, { token: token.uid, count: 5, price: MIN_IOTA_AMOUNT })
    const sellOrder = await testEnv.wrap(sellMintedTokenOrder)({})
    await wallet.send(sellerAddress, sellOrder.payload.targetAddress, 0, { amount: HexHelper.fromBigInt256(bigInt(5)), id: token.mintingData?.tokenId! })

    mockWalletReturnValue(walletSpy, buyer, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT })
    const buyOrder = await testEnv.wrap(buyToken)({})
    await wallet.send(buyerAddress, buyOrder.payload.targetAddress, 10 * MIN_IOTA_AMOUNT)

    await wait(async () => {
      const balance = await addressBalance(wallet.client, buyerAddress.bech32)
      return Number(Object.values(balance.nativeTokens)[0]) === 5
    })

    await wait(async () => {
      const balance = await addressBalance(wallet.client, sellerAddress.bech32)
      return Number(Object.values(balance.nativeTokens)[0]) === 995
    })

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer)
    await wait(async () => {
      const snap = await query.get()
      return snap.size !== 0
    })

    const buy = <TokenBuySellOrder>(await query.get()).docs[0].data()
    const cancelRequest = { uid: buy.uid }
    mockWalletReturnValue(walletSpy, buyer, cancelRequest);
    await testEnv.wrap(cancelBuyOrSell)({});

    await wait(async () => {
      const balance = await addressBalance(wallet.client, buyerAddress.bech32)
      return Number(balance.balance) === 15269000
    })
  })

  it('Half fulfill sell', async () => {
    const wallet = WalletService.newWallet(network) as SmrWallet

    mockWalletReturnValue(walletSpy, seller, { token: token.uid, count: 10, price: MIN_IOTA_AMOUNT })
    const sellOrder = await testEnv.wrap(sellMintedTokenOrder)({})
    await wallet.send(sellerAddress, sellOrder.payload.targetAddress, 0, { amount: HexHelper.fromBigInt256(bigInt(10)), id: token.mintingData?.tokenId! })

    mockWalletReturnValue(walletSpy, buyer, { token: token.uid, count: 5, price: MIN_IOTA_AMOUNT })
    const buyOrder = await testEnv.wrap(buyToken)({})
    await wallet.send(buyerAddress, buyOrder.payload.targetAddress, 5 * MIN_IOTA_AMOUNT)

    await wait(async () => {
      const balance = await addressBalance(wallet.client, buyerAddress.bech32)
      return Number(Object.values(balance.nativeTokens)[0]) === 5
    })
  })

  afterEach(async () => {
    await listener.cancel()
  })

})

const saveToken = async (space: string, seller: string) => {
  const tokenId = wallet.getRandomEthAddress()
  const token = ({
    symbol: 'SOON',
    totalSupply: 1000,
    approved: true,
    updatedOn: serverTime(),
    createdOn: serverTime(),
    space,
    uid: tokenId,
    createdBy: seller,
    name: 'MyToken',
    status: TokenStatus.AVAILABLE,
    access: 0
  })
  await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token as Token
}
