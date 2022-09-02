import dayjs from 'dayjs';
import { Network, Transaction, TransactionIgnoreWalletReason, TransactionOrderType, TransactionType, TransactionValidationType } from '../interfaces/models';
import { COL } from '../interfaces/models/base';
import admin from '../src/admin.config';
import { SmrWallet } from '../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../src/services/wallet/wallet';
import { generateRandomAmount } from '../src/utils/common.utils';
import { dateToTimestamp, serverTime } from '../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../src/utils/wallet.utils';
import { wait } from '../test/controls/common';
import { MilestoneListener } from './db-sync.utils';
import { requestFundsFromFaucet } from './faucet';

describe('Transaction match', () => {
  let order: Transaction;
  let wallet: SmrWallet;
  let address: AddressDetails
  let listenerRMS: MilestoneListener

  beforeAll(async () => {
    wallet = (await WalletService.newWallet(Network.RMS)) as SmrWallet
    listenerRMS = new MilestoneListener(Network.RMS)
  })

  beforeEach(async () => {
    order = await saveOrder(wallet)
    address = await wallet.getNewIotaAddressDetails()
    await requestFundsFromFaucet(Network.RMS, address.bech32, order.payload.amount)
  })

  it('Should create invalid payment, time unlock condition', async () => {
    await wallet.send(
      address,
      order.payload.targetAddress,
      order.payload.amount,
      { vestingAt: dateToTimestamp(dayjs()) }
    )
    const creditSnapQuery = admin.firestore().collection(COL.TRANSACTION)
      .where('member', '==', order.member)
      .where('type', '==', TransactionType.CREDIT)
    await wait(async () => {
      const snap = await creditSnapQuery.get()
      return snap.size === 1
    })
    const credit = <Transaction>(await creditSnapQuery.get()).docs[0].data()
    expect(credit.ignoreWallet).toBe(true)
    expect(credit.ignoreWalletReason).toBe(TransactionIgnoreWalletReason.UNREFUNDABLE_DUE_UNLOCK_CONDITIONS)
  })

  it('Should create invalid payment, storage unlock condition', async () => {
    await wallet.send(
      address,
      order.payload.targetAddress,
      order.payload.amount,
      { storageDepositReturnAddress: address.bech32 }
    )
    const creditSnapQuery = admin.firestore().collection(COL.TRANSACTION)
      .where('member', '==', order.member)
      .where('type', '==', TransactionType.CREDIT)
    await wait(async () => {
      const snap = await creditSnapQuery.get()
      return snap.size === 1
    })
    const credit = <Transaction>(await creditSnapQuery.get()).docs[0].data()
    expect(credit.ignoreWallet).toBe(true)
    expect(credit.ignoreWalletReason).toBe(TransactionIgnoreWalletReason.UNREFUNDABLE_DUE_UNLOCK_CONDITIONS)
  })

  afterAll(async () => {
    await listenerRMS.cancel()
  })
})

const saveOrder = async (wallet: SmrWallet) => {
  const targetAddress = await wallet.getNewIotaAddressDetails()
  const data = <Transaction>{
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: getRandomEthAddress(),
    space: getRandomEthAddress(),
    createdOn: serverTime(),
    sourceNetwork: Network.RMS,
    targetNetwork: Network.RMS,
    payload: {
      type: TransactionOrderType.SELL_MINTED_TOKEN,
      amount: generateRandomAmount(),
      targetAddress: targetAddress.bech32,
      validationType: TransactionValidationType.ADDRESS,
    }
  }
  await admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`).create(data)
  return data
}
