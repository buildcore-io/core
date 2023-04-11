/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
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

  it.each([Network.ATOI, Network.RMS])(
    'Should run all simple transaction one by one',
    async (network: Network) => {
      const count = 3;
      await setup(network, count * MIN_IOTA_AMOUNT);

      const billPaymentIds = Array.from(Array(count)).map(() => getRandomEthAddress());

      const promises = billPaymentIds.map((uid) => {
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
        };
        const docRef = soonDb().doc(`${COL.TRANSACTION}/${billPayment.uid}`);
        return docRef.create(billPayment);
      });
      await Promise.all(promises);

      const query = soonDb()
        .collection(COL.TRANSACTION)
        .where('payload.sourceAddress', '==', sourceAddress.bech32);
      await wait(async () => {
        const snap = await query.get<Transaction>();
        const allConfirmed = snap.reduce(
          (acc, act) => acc && act?.payload?.walletReference?.confirmed,
          true,
        );
        return snap.length === count && allConfirmed;
      });
      const snap = await query.get<Transaction>();
      for (const doc of snap) {
        expect(doc?.payload?.walletReference?.count).toBe(1);
      }
    },
  );
});
