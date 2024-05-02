/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  SOON_PROJECT_ID,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
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

  it('Should rerun transaction on different node', async () => {
    const network = Network.RMS;
    await setup(network);
    let billPayment = <Transaction>{
      project: SOON_PROJECT_ID,
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
    const docRef = build5Db().doc(COL.TRANSACTION, billPayment.uid);
    await docRef.create(billPayment);

    await wait(async () => {
      const data = <Transaction>await docRef.get();
      return !isEmpty(data?.payload?.walletReference?.chainReferences);
    });

    const data = <Transaction>await docRef.get();
    const nodeIndex = data?.payload?.walletReference?.nodeIndex;
    expect(nodeIndex).toBeDefined();

    let retryWalletResult = await retryWallet();
    expect(retryWalletResult.find((r) => r == billPayment.uid)).toBeUndefined();
    docRef.update({
      payload_walletReference_processedOn: dayjs().subtract(4, 'minute').toDate(),
      payload_amount: MIN_IOTA_AMOUNT,
    });

    retryWalletResult = await retryWallet();
    expect(retryWalletResult.find((r) => r == billPayment.uid)).toBeDefined();

    await wait(async () => {
      const data = await docRef.get();
      return data?.payload?.walletReference?.confirmed;
    });

    const billPaymentDocRef = build5Db().doc(COL.TRANSACTION, billPayment.uid);
    await wait(async () => {
      billPayment = <Transaction>await billPaymentDocRef.get();
      return billPayment.payload?.walletReference?.confirmed;
    });

    billPayment = <Transaction>await billPaymentDocRef.get();
    expect(billPayment.payload.walletReference?.nodeIndex).not.toBe(nodeIndex);
  });
});
