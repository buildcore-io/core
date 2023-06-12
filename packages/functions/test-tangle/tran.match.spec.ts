import {
  COL,
  Network,
  Transaction,
  TransactionIgnoreWalletReason,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
} from '@build5/interfaces';
import { soonDb } from '../src/firebase/firestore/soondb';
import { SmrWallet } from '../src/services/wallet/SmrWalletService';
import { AddressDetails } from '../src/services/wallet/wallet';
import { generateRandomAmount } from '../src/utils/common.utils';
import { serverTime } from '../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../src/utils/wallet.utils';
import { wait } from '../test/controls/common';
import { getWallet } from '../test/set-up';
import { requestFundsFromFaucet } from './faucet';

describe('Transaction match', () => {
  let order: Transaction;
  let wallet: SmrWallet;
  let address: AddressDetails;

  beforeAll(async () => {
    wallet = (await getWallet(Network.RMS)) as SmrWallet;
  });

  beforeEach(async () => {
    order = await saveOrder(wallet);
    address = await wallet.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.RMS, address.bech32, order.payload.amount);
  });

  it('Should create invalid payment, time unlock condition', async () => {
    await wallet.send(address, order.payload.targetAddress, order.payload.amount, {
      vestingAt: serverTime(),
    });
    const creditSnapQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', order.member)
      .where('type', '==', TransactionType.CREDIT);
    await wait(async () => {
      const snap = await creditSnapQuery.get();
      return snap.length === 1;
    });
    const credit = <Transaction>(await creditSnapQuery.get())[0];
    expect(credit.ignoreWallet).toBe(true);
    expect(credit.ignoreWalletReason).toBe(
      TransactionIgnoreWalletReason.UNREFUNDABLE_DUE_TIMELOCK_CONDITION,
    );
  });

  it('Should create invalid payment, storage unlock condition', async () => {
    await wallet.send(address, order.payload.targetAddress, order.payload.amount, {
      storageDepositReturnAddress: address.bech32,
    });
    const creditSnapQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', order.member)
      .where('type', '==', TransactionType.CREDIT);
    await wait(async () => {
      const snap = await creditSnapQuery.get();
      return snap.length === 1;
    });
    const credit = <Transaction>(await creditSnapQuery.get())[0];
    expect(credit.ignoreWallet).toBe(true);
    expect(credit.ignoreWalletReason).toBe(
      TransactionIgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION,
    );
  });
});

const saveOrder = async (wallet: SmrWallet) => {
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const data = <Transaction>{
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: getRandomEthAddress(),
    space: getRandomEthAddress(),
    createdOn: serverTime(),
    network: Network.RMS,
    payload: {
      type: TransactionOrderType.SELL_TOKEN,
      amount: generateRandomAmount(),
      targetAddress: targetAddress.bech32,
      validationType: TransactionValidationType.ADDRESS,
    },
  };
  await soonDb().doc(`${COL.TRANSACTION}/${data.uid}`).create(data);
  return data;
};
