/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { retryWallet } from '../../src/cron/wallet.cron';
import { soonDb } from '../../src/firebase/firestore/soondb';
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

  it('Should rerun transaction only after RETRY_UNCOFIRMED_PAYMENT_DELAY', async () => {
    const network = Network.ATOI;
    await setup(network);
    let billPayment = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      createdOn: serverTime(),
      network,
      payload: {
        amount: 2 * MIN_IOTA_AMOUNT,
        sourceAddress: sourceAddress.bech32,
        targetAddress: targetAddress.bech32,
        void: false,
      },
    };
    const docRef = soonDb().doc(`${COL.TRANSACTION}/${billPayment.uid}`);
    await docRef.create(billPayment);

    await wait(async () => {
      const data = <Transaction>await docRef.get();
      return !isEmpty(data?.payload?.walletReference?.chainReferences);
    });

    let retryWalletResult = await retryWallet();
    expect(retryWalletResult.find((r) => r == billPayment.uid)).toBeUndefined();
    docRef.update({
      'payload.walletReference.processedOn': dateToTimestamp(
        dayjs().subtract(4, 'minute').toDate(),
      ),
      'payload.amount': MIN_IOTA_AMOUNT,
    });

    retryWalletResult = await retryWallet();
    expect(retryWalletResult.find((r) => r == billPayment.uid)).toBeDefined();

    await wait(async () => {
      const data = await docRef.get<Transaction>();
      return data?.payload?.walletReference?.confirmed;
    });

    await wait(async () => {
      billPayment = <Transaction>await soonDb().doc(`${COL.TRANSACTION}/${billPayment.uid}`).get();
      return billPayment.payload?.walletReference?.confirmed;
    });
  });
});
