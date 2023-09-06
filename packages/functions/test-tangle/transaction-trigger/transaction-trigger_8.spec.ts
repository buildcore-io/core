/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
import { COL, MIN_IOTA_AMOUNT, Network, Transaction, TransactionType } from '@build-5/interfaces';
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

  it('Should run transactions with storage dep address', async () => {
    const network = Network.RMS;
    const count = 3;
    await setup(network, count * MIN_IOTA_AMOUNT, 3 * MIN_IOTA_AMOUNT);
    const billPaymentIds = Array.from(Array(count)).map(() => getRandomEthAddress());
    const promises = billPaymentIds.map((uid, i) => {
      const billPayment = <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid,
        createdOn: serverTime(),
        network,
        payload: {
          amount: MIN_IOTA_AMOUNT,
          sourceAddress: sourceAddress.bech32,
          targetAddress: targetAddress.bech32,
          storageDepositSourceAddress: i > 0 ? storageDepositSourceAddress.bech32 : '',
          void: false,
        },
      };
      const docRef = build5Db().doc(`${COL.TRANSACTION}/${billPayment.uid}`);
      return docRef.create(billPayment);
    });
    await Promise.all(promises);

    await wait(async () => {
      const snap = await build5Db()
        .collection(COL.TRANSACTION)
        .where('payload.sourceAddress', '==', sourceAddress.bech32)
        .where('payload.walletReference.confirmed', '==', true)
        .get<Transaction>();
      const countSum = snap.reduce(
        (acc, act) => acc + (act?.payload?.walletReference?.count || 0),
        0,
      );
      return snap.length === count && countSum === count;
    });
  });
});
