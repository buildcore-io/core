/* eslint-disable @typescript-eslint/no-explicit-any */
import { addressBalance, STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE } from '@iota/iota.js-next'
import { MIN_IOTA_AMOUNT } from '../interfaces/config'
import { Network, Transaction, TransactionType } from '../interfaces/models'
import { COL } from '../interfaces/models/base'
import admin from '../src/admin.config'
import { MnemonicService } from '../src/services/wallet/mnemonic'
import { SmrWallet } from '../src/services/wallet/SmrWalletService'
import { AddressDetails, WalletService } from '../src/services/wallet/wallet'
import { packBasicOutput } from '../src/utils/basic-output.utils'
import { serverTime } from '../src/utils/dateTime.utils'
import { getRandomEthAddress } from '../src/utils/wallet.utils'
import { wait } from '../test/controls/common'
import { MINTED_TOKEN_ID, requestFundsFromFaucet, VAULT_MNEMONIC } from './faucet'

describe('Transaction trigger spec', () => {
  let sourceAddress: AddressDetails
  let targetAddress: AddressDetails

  const setup = async (network: Network, amount = MIN_IOTA_AMOUNT) => {
    const wallet = WalletService.newWallet(network)
    sourceAddress = await wallet.getNewIotaAddressDetails()
    targetAddress = await wallet.getNewIotaAddressDetails()
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
    const wallet = WalletService.newWallet(network) as SmrWallet
    const vaultAddress = await wallet.getIotaAddressDetails(VAULT_MNEMONIC)
    await MnemonicService.store(vaultAddress.bech32, vaultAddress.mnemonic)

    const output = packBasicOutput(targetAddress.bech32, 0, [{ amount: '0x1', id: MINTED_TOKEN_ID }], await wallet.client.info())
    await requestFundsFromFaucet(network, sourceAddress.bech32, Number(output.amount))

    const billPayment = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      createdOn: serverTime(),
      sourceNetwork: network,
      targetNetwork: network,
      payload: {
        amount: Number(output.amount),
        nativeTokens: [{ amount: 1, id: MINTED_TOKEN_ID }],
        storageDepositSourceAddress: sourceAddress.bech32,
        sourceAddress: vaultAddress.bech32,
        targetAddress: targetAddress.bech32,
        void: false,
      },
    }
    await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).create(billPayment)

    await wait(async () => {
      const balance = await addressBalance(wallet.client, targetAddress.bech32)
      return Number(Object.values(balance.nativeTokens)[0]) === 1
    })
    await wait(async () => {
      const balance = await addressBalance(wallet.client, sourceAddress.bech32)
      return Number(balance.balance) === MIN_IOTA_AMOUNT
    })
  })

  it('Should send native tokens and credit it', async () => {
    const network = Network.RMS
    await setup(network)
    const wallet = WalletService.newWallet(network) as SmrWallet
    const vaultAddress = await wallet.getIotaAddressDetails(VAULT_MNEMONIC)
    await MnemonicService.store(vaultAddress.bech32, vaultAddress.mnemonic)

    const output = packBasicOutput(targetAddress.bech32, 0, [{ amount: '0x1', id: MINTED_TOKEN_ID }], await wallet.client.info())
    await requestFundsFromFaucet(network, sourceAddress.bech32, Number(output.amount))

    const billPayment = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      createdOn: serverTime(),
      sourceNetwork: network,
      targetNetwork: network,
      payload: {
        amount: Number(output.amount),
        nativeTokens: [{ amount: 1, id: MINTED_TOKEN_ID }],
        storageDepositSourceAddress: sourceAddress.bech32,
        sourceAddress: vaultAddress.bech32,
        targetAddress: targetAddress.bech32,
        void: false,
      },
    }
    await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).create(billPayment)

    await wait(async () => {
      const balance = await addressBalance(wallet.client, targetAddress.bech32)
      return Number(Object.values(balance.nativeTokens)[0]) === 1
    })

    const credit = <Transaction>{
      type: TransactionType.CREDIT,
      uid: getRandomEthAddress(),
      createdOn: serverTime(),
      sourceNetwork: network,
      targetNetwork: network,
      payload: {
        amount: Number(output.amount),
        nativeTokens: [{ amount: 1, id: MINTED_TOKEN_ID }],
        sourceAddress: targetAddress.bech32,
        targetAddress: sourceAddress.bech32,
        void: false,
      },
    }
    await admin.firestore().doc(`${COL.TRANSACTION}/${credit.uid}`).create(credit)

    await wait(async () => {
      const balance = await addressBalance(wallet.client, sourceAddress.bech32)
      return Number(Object.values(balance.nativeTokens)[0]) === 1
    })
  })

})
