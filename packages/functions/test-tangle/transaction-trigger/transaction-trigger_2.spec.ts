/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  SOON_PROJECT_ID,
  Transaction,
  TransactionType,
} from '@buildcore/interfaces';
import { UnlockConditionType } from '@iota/sdk';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { serverTime } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { wait } from '../../test/controls/common';
import { getWallet } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';

describe('Transaction trigger spec', () => {
  let sourceAddress: AddressDetails;
  let targetAddress: AddressDetails;
  let storageDepositSourceAddress: AddressDetails;

  const setup = async (network: Network, amount = MIN_IOTA_AMOUNT, storageDep = 0) => {
    const wallet = await getWallet(network);
    sourceAddress = await wallet.getNewIotaAddressDetails();
    targetAddress = await wallet.getNewIotaAddressDetails();
    await requestFundsFromFaucet(network, sourceAddress.bech32, amount);
    if (storageDep) {
      storageDepositSourceAddress = await wallet.getNewIotaAddressDetails();
      await requestFundsFromFaucet(network, storageDepositSourceAddress.bech32, amount);
    }
  };

  it('Bill payment with storage return condition', async () => {
    const network = Network.RMS;
    await setup(network);
    const wallet = await getWallet(network);
    const billPayment = <Transaction>{
      project: SOON_PROJECT_ID,
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      createdOn: serverTime(),
      network,
      payload: {
        amount: MIN_IOTA_AMOUNT,
        storageReturn: {
          amount: 0,
          address: sourceAddress.bech32,
        },
        sourceAddress: sourceAddress.bech32,
        targetAddress: targetAddress.bech32,
        void: false,
      },
    };
    const docRef = database().doc(COL.TRANSACTION, billPayment.uid);
    await docRef.create(billPayment);
    await wait(async () => {
      const doc = await docRef.get();
      return doc?.payload?.walletReference?.confirmed;
    });
    const outputs = await wallet.getOutputs(targetAddress.bech32, [], undefined);
    expect(Object.values(outputs).length).toBe(1);
    const hasStorageUnlock =
      Object.values(outputs)[0].unlockConditions.find(
        (u) => u.type === UnlockConditionType.StorageDepositReturn,
      ) !== undefined;
    expect(hasStorageUnlock).toBe(true);
  });
});
