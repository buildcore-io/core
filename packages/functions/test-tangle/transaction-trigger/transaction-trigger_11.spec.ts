/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  NetworkAddress,
  SOON_PROJECT_ID,
  Transaction,
  TransactionType,
} from '@buildcore/interfaces';
import { isEmpty, isEqual } from 'lodash';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
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

  it.each([Network.ATOI, Network.RMS])(
    'Should set consumedOutputIds on mnemonic',
    async (network: Network) => {
      await setup(network);
      const outputIds = await getOutputs(network, sourceAddress);
      const billPayment = dummyPayment(
        TransactionType.BILL_PAYMENT,
        network,
        sourceAddress.bech32,
        targetAddress.bech32,
      );
      await database().doc(COL.TRANSACTION, billPayment.uid).create(billPayment);

      await wait(async () => {
        const mnemonic = await MnemonicService.getData(sourceAddress.bech32);
        return isEqual(mnemonic.consumedOutputIds, outputIds);
      });

      await wait(async () => {
        const mnemonic = await MnemonicService.getData(sourceAddress.bech32);
        const payment = <Transaction>await database().doc(COL.TRANSACTION, billPayment.uid).get();
        return (
          isEmpty(mnemonic.consumedOutputIds) &&
          payment?.payload?.walletReference?.confirmed &&
          !payment?.payload?.walletReference?.inProgress
        );
      });
    },
  );
});

const dummyPayment = (
  type: TransactionType,
  network: Network,
  sourceAddress: NetworkAddress,
  targetAddress: NetworkAddress,
  amount = MIN_IOTA_AMOUNT,
) =>
  <Transaction>{
    project: SOON_PROJECT_ID,
    type,
    uid: getRandomEthAddress(),
    createdOn: serverTime(),
    network,
    payload: {
      amount,
      sourceAddress,
      targetAddress,
      void: false,
      dependsOnBillPayment: type === TransactionType.CREDIT,
    },
  };

const getOutputs = async (network: Network, address: AddressDetails) => {
  const wallet = await getWallet(network);
  const outputs = await wallet.getOutputs(address.bech32, [], false);
  return Object.keys(outputs);
};
