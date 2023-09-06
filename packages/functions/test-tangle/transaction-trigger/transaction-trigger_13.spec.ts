/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
import {
  COL,
  MAX_WALLET_RETRY,
  MIN_IOTA_AMOUNT,
  Mnemonic,
  Network,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { retryWallet } from '../../src/cron/wallet.cron';
import { IotaWallet } from '../../src/services/wallet/IotaWalletService';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails } from '../../src/services/wallet/wallet';
import { dateToTimestamp, serverTime } from '../../src/utils/dateTime.utils';
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
      await build5Db().doc(`${COL.TRANSACTION}/${billPayment.uid}`).create(billPayment);
      await new Promise((r) => setTimeout(r, 1000));

      await build5Db()
        .doc(`${COL.MNEMONIC}/${sourceAddress.bech32}`)
        .update({ lockedBy: billPayment.uid, consumedOutputIds: outputIds });
      await build5Db()
        .doc(`${COL.TRANSACTION}/${billPayment.uid}`)
        .update({
          ignoreWallet: false,
          'payload.walletReference.confirmed': false,
          'payload.walletReference.inProgress': true,
          'payload.walletReference.count': MAX_WALLET_RETRY,
          'payload.walletReference.processedOn': dateToTimestamp(
            dayjs().subtract(4, 'minute').toDate(),
          ),
        });

      let billPayment2 = dummyPayment(
        TransactionType.BILL_PAYMENT,
        network,
        sourceAddress.bech32,
        targetAddress.bech32,
      );
      await build5Db().doc(`${COL.TRANSACTION}/${billPayment2.uid}`).create(billPayment2);

      await retryWallet();

      await wait(async () => {
        const mnemonic = <Mnemonic>(
          await build5Db().doc(`${COL.MNEMONIC}/${sourceAddress.bech32}`).get()
        );
        billPayment = <Transaction>(
          await build5Db().doc(`${COL.TRANSACTION}/${billPayment.uid}`).get()
        );
        return (
          !billPayment.payload?.walletReference?.inProgress &&
          !billPayment.payload?.walletReference?.confirmed &&
          isEmpty(mnemonic.consumedOutputIds) &&
          isEmpty(mnemonic.lockedBy)
        );
      });

      await wait(async () => {
        billPayment2 = <Transaction>(
          await build5Db().doc(`${COL.TRANSACTION}/${billPayment2.uid}`).get()
        );
        return billPayment2.payload?.walletReference?.confirmed;
      });
    },
  );
});

const dummyPayment = (
  type: TransactionType,
  network: Network,
  sourceAddress: string,
  targetAddress: string,
  amount = MIN_IOTA_AMOUNT,
) =>
  <Transaction>{
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
  if (network === Network.RMS) {
    const outputs = await (wallet as SmrWallet).getOutputs(address.bech32, [], false);
    return Object.keys(outputs);
  }
  const outputs = await (wallet as IotaWallet).getOutputs(address.hex);
  return Object.keys(outputs);
};
