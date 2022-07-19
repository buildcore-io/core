import { addressBalance, STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE } from '@iota/iota.js-next'
import { MIN_IOTA_AMOUNT } from '../interfaces/config'
import { Member, Network, Token, TokenStatus, Transaction, TransactionType } from '../interfaces/models'
import { COL } from '../interfaces/models/base'
import admin from '../src/admin.config'
import { claimMintedTokenOrder, mintTokenOrder } from '../src/controls/token-mint.controller'
import { MnemonicService } from '../src/services/wallet/mnemonic'
import { SmrWallet } from '../src/services/wallet/SmrWalletService'
import { AddressDetails, WalletService } from '../src/services/wallet/wallet'
import { getAddress } from '../src/utils/address.utils'
import { serverTime } from '../src/utils/dateTime.utils'
import * as wallet from '../src/utils/wallet.utils'
import { getRandomEthAddress } from '../src/utils/wallet.utils'
import { createMember, createSpace, mockWalletReturnValue, wait } from '../test/controls/common'
import { testEnv } from '../test/set-up'
import { MilestoneListener } from './db-sync.utils'
import { requestFundsFromFaucet } from './faucet'

let walletSpy: any;
describe('Transaction trigger spec', () => {
    let sourceAddress: AddressDetails
    let targetAddress: AddressDetails

    const setup = async (network: Network, amount = MIN_IOTA_AMOUNT) => {
        const wallet = WalletService.newWallet(network)
        sourceAddress = await wallet.getNewIotaAddressDetails()
        targetAddress = await wallet.getNewIotaAddressDetails()
        await MnemonicService.store(sourceAddress.bech32, sourceAddress.mnemonic, network)
        await MnemonicService.store(targetAddress.bech32, sourceAddress.mnemonic, network)
        await requestFundsFromFaucet(network, sourceAddress.bech32, amount)
    }

    it.each([Network.RMS, Network.ATOI])('Should send bill payment with base tokens', async (network) => {
        await setup(network)
        const wallet = WalletService.newWallet(network)
        const billPayment = <Transaction>{
            type: TransactionType.BILL_PAYMENT,
            uid: getRandomEthAddress(),
            createdOn: serverTime(),
            sourceNetwork: network,
            targetNetwork: network,
            payload: {
                amount: MIN_IOTA_AMOUNT,
                sourceAddress: sourceAddress.bech32,
                targetAddress: targetAddress.bech32,
                void: false,
            },
        }
        await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).create(billPayment)
        await wait(async () => {
            const balance = await wallet.getBalance(targetAddress.bech32)
            return balance === MIN_IOTA_AMOUNT
        })
    })

    it('Bill payment with storage return condition', async () => {
        const network = Network.RMS
        await setup(network)
        const wallet = WalletService.newWallet(network) as SmrWallet
        const billPayment = <Transaction>{
            type: TransactionType.BILL_PAYMENT,
            uid: getRandomEthAddress(),
            createdOn: serverTime(),
            sourceNetwork: network,
            targetNetwork: network,
            payload: {
                amount: MIN_IOTA_AMOUNT,
                storageReturn: {
                    amount: 0,
                    address: sourceAddress.bech32
                },
                sourceAddress: sourceAddress.bech32,
                targetAddress: targetAddress.bech32,
                void: false,
            },
        }
        await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).create(billPayment)
        await wait(async () => {
            const balance = await wallet.getBalance(targetAddress.bech32)
            return balance === MIN_IOTA_AMOUNT
        })
        const outputs = await wallet.getOutputs(targetAddress.bech32)
        expect(Object.values(outputs).length).toBe(1)
        const hasStorageUnlock = Object.values(outputs)[0].unlockConditions.find(u => u.type === STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE) !== undefined
        expect(hasStorageUnlock).toBe(true)
    })

    it('Should send native tokens', async () => {
        const network = Network.RMS
        await setup(network)
        const walletService = WalletService.newWallet(network) as SmrWallet
        walletSpy = jest.spyOn(wallet, 'decodeAuth');
        const listener = new MilestoneListener(network);

        const memberId = await createMember(walletSpy, Network.RMS)
        const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${memberId}`).get()).data()
        const address = getAddress(member.validatedAddress, network)
        await requestFundsFromFaucet(network, address, 10 * MIN_IOTA_AMOUNT)
        const space = await createSpace(walletSpy, memberId)
        const token = await saveToken(space.uid, memberId)

        mockWalletReturnValue(walletSpy, memberId, { token: token.uid, targetNetwork: network })
        const order = await testEnv.wrap(mintTokenOrder)({});
        const from = await walletService.getIotaAddressDetails(await MnemonicService.get(address))
        await walletService.send(from, order.payload.targetAddress, order.payload.amount)

        await wait(async () => {
            const snap = await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()
            return snap.data()?.status === TokenStatus.MINTED
        })

        mockWalletReturnValue(walletSpy, memberId, { token: token.uid })
        const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({})
        await walletService.send(from, claimOrder.payload.targetAddress, claimOrder.payload.amount)

        await wait(async () => {
            const balance = await addressBalance(walletService.client, from.bech32)
            return Number(Object.values(balance.nativeTokens)[0]) === 1000
        })

        const tokenData = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${token.uid}`).get()).data()
        const billPayment = <Transaction>{
            type: TransactionType.BILL_PAYMENT,
            uid: getRandomEthAddress(),
            createdOn: serverTime(),
            sourceNetwork: network,
            targetNetwork: network,
            payload: {
                amount: 0,
                nativeToken: {
                    amount: 1000,
                    id: tokenData.mintingData?.tokenId!
                },
                sourceAddress: from.bech32,
                targetAddress: targetAddress.bech32,
                void: false,
            },
        }
        await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).create(billPayment)

        await wait(async () => {
            const balance = await addressBalance(walletService.client, targetAddress.bech32)
            return Number(Object.values(balance.nativeTokens)[0]) === 1000
        })

        await listener.cancel()
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
    return token
}
