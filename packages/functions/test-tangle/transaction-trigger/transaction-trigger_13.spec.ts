/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import {
  COL,
  MAX_WALLET_RETRY,
  MIN_IOTA_AMOUNT,
  Mnemonic,
  Network,
  NetworkAddress,
  SOON_PROJECT_ID,
  Transaction,
  TransactionType,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { retryWallet } from '../../src/cron/wallet.cron';
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

  it.each([Network.RMS, Network.ATOI])(
    'Should unclock mnemonic after max retry reached',
    async (network: Network) => {
      await setup(network);
      const outputIds = await getOutputs(network, sourceAddress);
      let billPayment = <Transaction>{
        ...dummyPayment(
          TransactionType.BILL_PAYMENT,
          network,
          sourceAddress.bech32,
          targetAddress.bech32,
        ),
        ignoreWallet: true,
      };
      await database().doc(COL.TRANSACTION, billPayment.uid).create(billPayment);
      await new Promise((r) => setTimeout(r, 1000));

      await database()
        .doc(COL.MNEMONIC, sourceAddress.bech32)
        .update({ lockedBy: billPayment.uid, consumedOutputIds: outputIds });
      await database()
        .doc(COL.TRANSACTION, billPayment.uid)
        .update({
          ignoreWallet: false,
          payload_walletReference_confirmed: false,
          payload_walletReference_inProgress: true,
          payload_walletReference_count: MAX_WALLET_RETRY,
          payload_walletReference_processedOn: dayjs().subtract(4, 'd').toDate(),
        });

      let billPayment2 = dummyPayment(
        TransactionType.BILL_PAYMENT,
        network,
        sourceAddress.bech32,
        targetAddress.bech32,
      );
      await database().doc(COL.TRANSACTION, billPayment2.uid).create(billPayment2);

      await retryWallet();

      await wait(async () => {
        const mnemonic = <Mnemonic>await database().doc(COL.MNEMONIC, sourceAddress.bech32).get();
        billPayment = <Transaction>await database().doc(COL.TRANSACTION, billPayment.uid).get();
        return (
          !billPayment.payload?.walletReference?.inProgress &&
          !billPayment.payload?.walletReference?.confirmed &&
          isEmpty(mnemonic.consumedOutputIds) &&
          isEmpty(mnemonic.lockedBy)
        );
      });

      await wait(async () => {
        billPayment2 = <Transaction>await database().doc(COL.TRANSACTION, billPayment2.uid).get();
        return billPayment2.payload?.walletReference?.confirmed;
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
    type,
    uid: getRandomEthAddress(),
    createdOn: serverTime(),
    network,
    project: SOON_PROJECT_ID,
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
