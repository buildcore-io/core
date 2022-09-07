/* eslint-disable @typescript-eslint/no-explicit-any */
import { addressBalance, STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE } from '@iota/iota.js-next'
import dayjs from 'dayjs'
import { isEmpty } from 'lodash'
import { MIN_IOTA_AMOUNT } from '../interfaces/config'
import { Network, Transaction, TransactionType } from '../interfaces/models'
import { COL } from '../interfaces/models/base'
import admin from '../src/admin.config'
import { retryWallet } from '../src/cron/wallet.cron'
import { MnemonicService } from '../src/services/wallet/mnemonic'
import { SmrWallet } from '../src/services/wallet/SmrWalletService'
import { AddressDetails, WalletService } from '../src/services/wallet/wallet'
import { packBasicOutput } from '../src/utils/basic-output.utils'
import { dateToTimestamp, serverTime } from '../src/utils/dateTime.utils'
import { getRandomEthAddress } from '../src/utils/wallet.utils'
import { wait } from '../test/controls/common'
import { projectId, testEnv } from '../test/set-up'
import { MilestoneListener } from './db-sync.utils'
import { requestFundsFromFaucet } from './faucet'

describe('Transaction trigger spec', () => {
  let sourceAddress: AddressDetails
  let targetAddress: AddressDetails
  let listenerATOI: MilestoneListener
  let listenerRMS: MilestoneListener

  beforeAll(() => {
    listenerATOI = new MilestoneListener(Network.ATOI)
    listenerRMS = new MilestoneListener(Network.RMS)
  })

  const setup = async (network: Network, amount = MIN_IOTA_AMOUNT) => {
    const wallet = await WalletService.newWallet(network)
    sourceAddress = await wallet.getNewIotaAddressDetails()
    targetAddress = await wallet.getNewIotaAddressDetails()
    await requestFundsFromFaucet(network, sourceAddress.bech32, amount)
  }

  it.each([Network.RMS, Network.ATOI])('Should send bill payment with base tokens', async (network) => {
    await setup(network)
    const wallet = await WalletService.newWallet(network)
    const billPayment = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      createdOn: serverTime(),
      network,
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
    const wallet = await WalletService.newWallet(network) as SmrWallet
    const billPayment = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      createdOn: serverTime(),
      network,
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
    const outputs = await wallet.getOutputs(targetAddress.bech32, true)
    expect(Object.values(outputs).length).toBe(1)
    const hasStorageUnlock = Object.values(outputs)[0].unlockConditions.find(u => u.type === STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE) !== undefined
    expect(hasStorageUnlock).toBe(true)
  })

  it('Should send native tokens', async () => {
    const network = Network.RMS
    await setup(network)
    const wallet = await WalletService.newWallet(network) as SmrWallet
    const vaultAddress = await wallet.getIotaAddressDetails(VAULT_MNEMONIC)
    await MnemonicService.store(vaultAddress.bech32, vaultAddress.mnemonic)

    const output = packBasicOutput(targetAddress.bech32, 0, [{ amount: '0x1', id: MINTED_TOKEN_ID }], await wallet.client.info())
    await requestFundsFromFaucet(network, sourceAddress.bech32, Number(output.amount))

    const billPayment = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      createdOn: serverTime(),
      network,
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
    const wallet = await WalletService.newWallet(network) as SmrWallet
    const vaultAddress = await wallet.getIotaAddressDetails(VAULT_MNEMONIC)
    await MnemonicService.store(vaultAddress.bech32, vaultAddress.mnemonic)

    const output = packBasicOutput(targetAddress.bech32, 0, [{ amount: '0x1', id: MINTED_TOKEN_ID }], await wallet.client.info())
    await requestFundsFromFaucet(network, sourceAddress.bech32, Number(output.amount))

    const billPayment = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      createdOn: serverTime(),
      network,
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
      network,
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

  it('Should rerun transaction only after RETRY_UNCOFIRMED_PAYMENT_DELAY', async () => {
    await testEnv.firestore.clearFirestoreData(projectId)
    const network = Network.ATOI
    await setup(network)
    const billPayment = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      createdOn: serverTime(), network,
      payload: {
        amount: 2 * MIN_IOTA_AMOUNT,
        sourceAddress: sourceAddress.bech32,
        targetAddress: targetAddress.bech32,
        void: false,
      },
    }
    const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`)
    await docRef.create(billPayment)

    await wait(async () => {
      const data = <Transaction>(await docRef.get()).data()
      return !isEmpty(data?.payload?.walletReference?.chainReferences)
    })

    let retryWalletResult = await retryWallet()
    expect(retryWalletResult).toEqual([undefined])
    docRef.update({
      'payload.walletReference.processedOn': dateToTimestamp(dayjs().subtract(2, 'minute').toDate()),
      'payload.amount': MIN_IOTA_AMOUNT
    })

    retryWalletResult = await retryWallet()
    expect(retryWalletResult.filter(r => r !== undefined).length).toBe(1)

    await wait(async () => {
      const data = (await docRef.get()).data()
      return data?.payload?.walletReference?.confirmed
    })
  })

  afterAll(async () => {
    await listenerATOI.cancel()
    await listenerRMS.cancel()
  })

})

const VAULT_MNEMONIC = 'crouch violin broom degree diet primary juice vacuum crouch invite cotton endorse zebra mosquito dawn evil motion turkey apple secret indicate miracle lady husband'
const MINTED_TOKEN_ID = '0x08a7d756feb7427a5e31b152fb425ede7ee938a8af0b0e2730ea809c8435022ecd0100000000'
