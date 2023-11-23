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

  it('Should process credit after bill after success', async () => {
    const network = Network.RMS;
    await setup(network, 3 * MIN_IOTA_AMOUNT);
    let billPayment1 = dummyPayment(
      TransactionType.BILL_PAYMENT,
      network,
      sourceAddress.bech32,
      targetAddress.bech32,
    );
    let billPayment2 = dummyPayment(
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
    batch.create(build5Db().doc(`${COL.TRANSACTION}/${billPayment1.uid}`), billPayment1);
    batch.create(build5Db().doc(`${COL.TRANSACTION}/${credit.uid}`), credit);
    batch.create(build5Db().doc(`${COL.TRANSACTION}/${billPayment2.uid}`), billPayment2);
    await batch.commit();
    await wait(async () => {
      billPayment1 = <Transaction>(
        await build5Db().doc(`${COL.TRANSACTION}/${billPayment1.uid}`).get()
      );
      billPayment2 = <Transaction>(
        await build5Db().doc(`${COL.TRANSACTION}/${billPayment2.uid}`).get()
      );
      credit = <Transaction>await build5Db().doc(`${COL.TRANSACTION}/${credit.uid}`).get();
      return (
        billPayment1?.payload?.walletReference?.confirmed &&
        billPayment2?.payload?.walletReference?.confirmed &&
        credit?.payload?.walletReference?.confirmed
      );
    });
    billPayment1 = <Transaction>(
      await build5Db().doc(`${COL.TRANSACTION}/${billPayment1.uid}`).get()
    );
    billPayment2 = <Transaction>(
      await build5Db().doc(`${COL.TRANSACTION}/${billPayment2.uid}`).get()
    );
    credit = <Transaction>await build5Db().doc(`${COL.TRANSACTION}/${credit.uid}`).get();

    expect(
      dayjs(billPayment1?.payload?.walletReference?.processedOn?.toDate()).isBefore(
        dayjs(credit?.payload?.walletReference?.processedOn?.toDate()),
      ),
    ).toBe(true);
    expect(
      dayjs(billPayment2?.payload?.walletReference?.processedOn?.toDate()).isBefore(
        dayjs(credit?.payload?.walletReference?.processedOn?.toDate()),
      ),
    ).toBe(true);
  });
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
    project: SOON_PROJECT_ID,
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
