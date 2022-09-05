/* eslint-disable @typescript-eslint/no-explicit-any */
import { addressBalance, STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE } from '@iota/iota.js-next'
import dayjs from 'dayjs'
import { isEmpty, isEqual } from 'lodash'
import { DEF_WALLET_PAY_IN_PROGRESS, MAX_WALLET_RETRY, MIN_IOTA_AMOUNT } from '../interfaces/config'
import { Network, Transaction, TransactionType } from '../interfaces/models'
import { COL } from '../interfaces/models/base'
import { Mnemonic } from '../interfaces/models/mnemonic'
import admin from '../src/admin.config'
import { retryWallet } from '../src/cron/wallet.cron'
import { IotaWallet } from '../src/services/wallet/IotaWalletService'
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
  let storageDepositSourceAddress: AddressDetails
  let listenerATOI: MilestoneListener
  let listenerRMS: MilestoneListener

  beforeAll(() => {
    listenerATOI = new MilestoneListener(Network.ATOI)
    listenerRMS = new MilestoneListener(Network.RMS)
  })

  beforeEach(async () => {
    await testEnv.firestore.clearFirestoreData(projectId)
  })

  const setup = async (network: Network, amount = MIN_IOTA_AMOUNT, storageDep = 0) => {

    const wallet = await WalletService.newWallet(network)
    sourceAddress = await wallet.getNewIotaAddressDetails()
    targetAddress = await wallet.getNewIotaAddressDetails()
    await requestFundsFromFaucet(network, sourceAddress.bech32, amount)
    if (storageDep) {
      storageDepositSourceAddress = await wallet.getNewIotaAddressDetails()
      await requestFundsFromFaucet(network, storageDepositSourceAddress.bech32, amount)
    }
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
    const outputs = await wallet.getOutputs(targetAddress.bech32, [], true)
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

  it.each([Network.ATOI, Network.RMS])('Should confirm simple transaction', async (network: Network) => {
    await setup(network)
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
    const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`)
    await docRef.create(billPayment)
    await wait(async () => {
      const doc = await docRef.get()
      return doc.data()?.payload?.walletReference?.confirmed === true && !doc.data()?.payload?.walletReference?.inProgress
    })
  })

  it.each([Network.ATOI, Network.RMS])('Should run all simple transaction one by one', async (network: Network) => {
    const count = 3
    await setup(network, count * MIN_IOTA_AMOUNT)
    const billPaymentIds = Array.from(Array(count)).map(() => getRandomEthAddress())
    const promises = billPaymentIds.map(uid => {
      const billPayment = <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid,
        createdOn: serverTime(),
        network,
        payload: {
          amount: MIN_IOTA_AMOUNT,
          sourceAddress: sourceAddress.bech32,
          targetAddress: targetAddress.bech32,
          void: false,
        },
      }
      const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`)
      return docRef.create(billPayment)
    })
    await Promise.all(promises)

    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TRANSACTION)
        .where('payload.sourceAddress', '==', sourceAddress.bech32)
        .where('payload.walletReference.confirmed', '==', true)
        .get()
      const countSum = snap.docs.reduce((acc, act) => acc + (act.data()?.payload?.walletReference?.count || 0), 0)
      return snap.size === count && countSum === count
    })
  })

  it('Should run transactions with storage dep address', async () => {
    const network = Network.RMS
    const count = 3
    await setup(network, count * MIN_IOTA_AMOUNT, 3 * MIN_IOTA_AMOUNT)
    const billPaymentIds = Array.from(Array(count)).map(() => getRandomEthAddress())
    const promises = billPaymentIds.map((uid, i) => {
      const billPayment = <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid,
        createdOn: serverTime(),
        network,
        payload: {
          amount: MIN_IOTA_AMOUNT,
          sourceAddress: sourceAddress.bech32,
          targetAddress: targetAddress.bech32,
          storageDepositSourceAddress: i > 0 ? storageDepositSourceAddress.bech32 : '',
          void: false,
        },
      }
      const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`)
      return docRef.create(billPayment)
    })
    await Promise.all(promises)

    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TRANSACTION)
        .where('payload.sourceAddress', '==', sourceAddress.bech32)
        .where('payload.walletReference.confirmed', '==', true)
        .get()
      const countSum = snap.docs.reduce((acc, act) => acc + (act.data()?.payload?.walletReference?.count || 0), 0)
      return snap.size === count && countSum === count
    })
  })

  it('Should process credit after bill', async () => {
    const network = Network.RMS
    await setup(network, 2 * MIN_IOTA_AMOUNT)
    let billPayment1 = dummyPayment(TransactionType.BILL_PAYMENT, network, sourceAddress.bech32, targetAddress.bech32)
    let billPayment2 = dummyPayment(TransactionType.BILL_PAYMENT, network, sourceAddress.bech32, targetAddress.bech32)
    let credit = dummyPayment(TransactionType.CREDIT, network, sourceAddress.bech32, targetAddress.bech32)
    const batch = admin.firestore().batch()
    batch.create(admin.firestore().doc(`${COL.TRANSACTION}/${billPayment1.uid}`), billPayment1)
    batch.create(admin.firestore().doc(`${COL.TRANSACTION}/${credit.uid}`), credit)
    batch.create(admin.firestore().doc(`${COL.TRANSACTION}/${billPayment2.uid}`), billPayment2)
    await batch.commit()
    await wait(async () => {
      billPayment1 = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment1.uid}`).get()).data()
      billPayment2 = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment2.uid}`).get()).data()
      credit = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${credit.uid}`).get()).data()
      return billPayment1?.payload?.walletReference?.confirmed &&
        billPayment2?.payload?.walletReference?.confirmed &&
        credit?.payload?.walletReference?.confirmed
    })
    billPayment1 = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment1.uid}`).get()).data()
    billPayment2 = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment2.uid}`).get()).data()
    credit = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${credit.uid}`).get()).data()

    expect(dayjs(billPayment1?.payload?.walletReference?.processedOn?.toDate())
      .isBefore(dayjs(credit?.payload?.walletReference?.processedOn?.toDate())))
    expect(dayjs(billPayment2?.payload?.walletReference?.processedOn?.toDate())
      .isBefore(dayjs(credit?.payload?.walletReference?.processedOn?.toDate())))
  })

  it.each([Network.ATOI, Network.RMS])('Should set consumedOutputIds on mnemonic', async (network: Network) => {
    await setup(network)
    const outputIds = await getOutputs(network, sourceAddress)
    const billPayment = dummyPayment(TransactionType.BILL_PAYMENT, network, sourceAddress.bech32, targetAddress.bech32)
    await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).create(billPayment)

    await wait(async () => {
      const mnemonic = await MnemonicService.getData(sourceAddress.bech32)
      return isEqual(mnemonic.consumedOutputIds, outputIds)
    })

    await wait(async () => {
      const mnemonic = await MnemonicService.getData(sourceAddress.bech32)
      const payment = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).get()).data()
      return isEmpty(mnemonic.consumedOutputIds) && payment?.payload?.walletReference?.confirmed && !payment?.payload?.walletReference?.inProgress
    })
  })

  it.each([Network.RMS, Network.ATOI])('Should retry with same output ids', async (network: Network) => {
    await setup(network)
    const outputIds = await getOutputs(network, sourceAddress)
    let billPayment = <Transaction>{ ...dummyPayment(TransactionType.BILL_PAYMENT, network, sourceAddress.bech32, targetAddress.bech32), ignoreWallet: true }
    await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).create(billPayment)
    await new Promise((r) => setTimeout(r, 1000));

    await admin.firestore().doc(`${COL.MNEMONIC}/${sourceAddress.bech32}`).update({ lockedBy: billPayment.uid, consumedOutputIds: outputIds })
    await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).update({
      ignoreWallet: false,
      'payload.walletReference.confirmed': false,
      'payload.walletReference.inProgress': true,
      'payload.walletReference.count': 1,
      'payload.walletReference.processedOn': dateToTimestamp(dayjs().subtract(2, 'minute').toDate()),
    })

    const result = await retryWallet()
    expect(result.filter(r => r !== undefined).length).toBe(1)

    await wait(async () => {
      const mnemonic = <Mnemonic>(await admin.firestore().doc(`${COL.MNEMONIC}/${sourceAddress.bech32}`).get()).data()
      billPayment = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).get()).data()
      return billPayment.payload?.walletReference?.chainReference &&
        !(billPayment.payload?.walletReference?.chainReference as string).includes(DEF_WALLET_PAY_IN_PROGRESS) &&
        isEqual(mnemonic.consumedOutputIds, outputIds)
    })

    await wait(async () => {
      billPayment = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).get()).data()
      return billPayment.payload?.walletReference?.confirmed
    })
  })

  it.each([Network.RMS, Network.ATOI])('Should unclock mnemonic after max retry reached', async (network: Network) => {
    await setup(network)
    const outputIds = await getOutputs(network, sourceAddress)
    let billPayment = <Transaction>{ ...dummyPayment(TransactionType.BILL_PAYMENT, network, sourceAddress.bech32, targetAddress.bech32), ignoreWallet: true }
    await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).create(billPayment)
    await new Promise((r) => setTimeout(r, 1000));

    await admin.firestore().doc(`${COL.MNEMONIC}/${sourceAddress.bech32}`).update({ lockedBy: billPayment.uid, consumedOutputIds: outputIds })
    await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).update({
      ignoreWallet: false,
      'payload.walletReference.confirmed': false,
      'payload.walletReference.inProgress': true,
      'payload.walletReference.count': MAX_WALLET_RETRY,
      'payload.walletReference.processedOn': dateToTimestamp(dayjs().subtract(2, 'minute').toDate()),
    })

    let billPayment2 = dummyPayment(TransactionType.BILL_PAYMENT, network, sourceAddress.bech32, targetAddress.bech32)
    await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment2.uid}`).create(billPayment2)

    await retryWallet()

    await wait(async () => {
      const mnemonic = <Mnemonic>(await admin.firestore().doc(`${COL.MNEMONIC}/${sourceAddress.bech32}`).get()).data()
      billPayment = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).get()).data()
      return !billPayment.payload?.walletReference?.inProgress && !billPayment.payload?.walletReference?.confirmed &&
        isEmpty(mnemonic.consumedOutputIds) && isEmpty(mnemonic.lockedBy)
    })

    await wait(async () => {
      billPayment2 = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment2.uid}`).get()).data()
      return billPayment2.payload?.walletReference?.confirmed
    })
  })

  afterAll(async () => {
    await listenerATOI.cancel()
    await listenerRMS.cancel()
  })

})

const VAULT_MNEMONIC = 'crouch violin broom degree diet primary juice vacuum crouch invite cotton endorse zebra mosquito dawn evil motion turkey apple secret indicate miracle lady husband'
const MINTED_TOKEN_ID = '0x08a7d756feb7427a5e31b152fb425ede7ee938a8af0b0e2730ea809c8435022ecd0100000000'

const dummyPayment = (type: TransactionType, network: Network, sourceAddress: string, targetAddress: string, amount = MIN_IOTA_AMOUNT) => (<Transaction>{
  type,
  uid: getRandomEthAddress(),
  createdOn: serverTime(),
  network,
  payload: {
    amount,
    sourceAddress,
    targetAddress,
    void: false,
  },
})

const getOutputs = async (network: Network, address: AddressDetails) => {
  const wallet = await WalletService.newWallet(network)
  if (network === Network.RMS) {
    return Object.keys(await (wallet as SmrWallet).getOutputs(address.bech32))
  }
  return (await (wallet as IotaWallet).client.addressEd25519Outputs(address.hex)).outputIds
}