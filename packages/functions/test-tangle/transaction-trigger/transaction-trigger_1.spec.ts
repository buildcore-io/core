/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { AddressDetails } from '../../src/services/wallet/wallet';
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
    'Should send bill payment with base tokens',
    async (network) => {
      await setup(network);
      const wallet = await getWallet(network);
      let billPayment = <Transaction>{
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
      };
      await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).create(billPayment);
      await wait(async () => {
        const balance = await wallet.getBalance(targetAddress.bech32);
        return balance === MIN_IOTA_AMOUNT;
      });

      await wait(async () => {
        billPayment = <Transaction>(
          (await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).get()).data()
        );
        return billPayment.payload?.walletReference?.confirmed;
      });
    },
  );
});
