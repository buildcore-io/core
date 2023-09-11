/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  NetworkAddress,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
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

  it('Should process credit after bill when created at the same time', async () => {
    const network = Network.RMS;
    await setup(network, 2 * MIN_IOTA_AMOUNT);
    let billPayment = dummyPayment(
      TransactionType.BILL_PAYMENT,
      network,
      sourceAddress.bech32,
      targetAddress.bech32,
    );
    let credit = dummyPayment(
      TransactionType.CREDIT,
      network,
      sourceAddress.bech32,
      targetAddress.bech32,
    );
    const batch = build5Db().batch();
    batch.create(build5Db().doc(`${COL.TRANSACTION}/${credit.uid}`), credit);
    batch.create(build5Db().doc(`${COL.TRANSACTION}/${billPayment.uid}`), billPayment);
    await batch.commit();

    await wait(async () => {
      billPayment = <Transaction>(
        await build5Db().doc(`${COL.TRANSACTION}/${billPayment.uid}`).get()
      );
      credit = <Transaction>await build5Db().doc(`${COL.TRANSACTION}/${credit.uid}`).get();
      return (
        billPayment?.payload?.walletReference?.confirmed &&
        credit?.payload?.walletReference?.confirmed
      );
    });

    expect(
      dayjs(billPayment?.payload?.walletReference?.processedOn?.toDate()).isBefore(
        dayjs(credit?.payload?.walletReference?.processedOn?.toDate()),
      ),
    ).toBe(true);
  });
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
    payload: {
      amount,
      sourceAddress,
      targetAddress,
      void: false,
      dependsOnBillPayment: type === TransactionType.CREDIT,
    },
  };
