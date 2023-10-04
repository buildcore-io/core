/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, MIN_IOTA_AMOUNT, Network, Transaction, TransactionType } from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
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
    'Should confirm simple transaction',
    async (network: Network) => {
      await setup(network);
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
      const docRef = build5Db().doc(`${COL.TRANSACTION}/${billPayment.uid}`);
      await docRef.create(billPayment);
      await wait(async () => {
        const doc = await docRef.get<Transaction>();
        return (
          doc?.payload?.walletReference?.confirmed === true &&
          !doc?.payload?.walletReference?.inProgress
        );
      });

      await wait(async () => {
        billPayment = <Transaction>(
          await build5Db().doc(`${COL.TRANSACTION}/${billPayment.uid}`).get()
        );
        return billPayment.payload?.walletReference?.confirmed;
      });
    },
  );
});
