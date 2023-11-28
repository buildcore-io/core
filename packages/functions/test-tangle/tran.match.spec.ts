import { build5Db } from '@build-5/database';
import {
  COL,
  IgnoreWalletReason,
  Network,
  SOON_PROJECT_ID,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
} from '@build-5/interfaces';
import { Wallet } from '../src/services/wallet/wallet';
import { AddressDetails } from '../src/services/wallet/wallet.service';
import { generateRandomAmount } from '../src/utils/common.utils';
import { serverTime } from '../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../src/utils/wallet.utils';
import { wait } from '../test/controls/common';
import { getWallet } from '../test/set-up';
import { requestFundsFromFaucet } from './faucet';

describe('Transaction match', () => {
  let order: Transaction;
  let wallet: Wallet;
  let address: AddressDetails;

  beforeAll(async () => {
    wallet = await getWallet(Network.RMS);
  });

  beforeEach(async () => {
    order = await saveOrder(wallet);
    address = await wallet.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.RMS, address.bech32, order.payload.amount!);
  });

  it('Should create invalid payment, time unlock condition', async () => {
    await wallet.send(address, order.payload.targetAddress!, order.payload.amount!, {
      vestingAt: serverTime(),
    });
    const creditSnapQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', order.member)
      .where('type', '==', TransactionType.CREDIT);
    await wait(async () => {
      const snap = await creditSnapQuery.get();
      return snap.length === 1;
    });
    const credit = <Transaction>(await creditSnapQuery.get())[0];
    expect(credit.ignoreWallet).toBe(true);
    expect(credit.ignoreWalletReason).toBe(IgnoreWalletReason.UNREFUNDABLE_DUE_TIMELOCK_CONDITION);
  });

  it('Should create invalid payment, storage unlock condition', async () => {
    await wallet.send(address, order.payload.targetAddress!, order.payload.amount!, {
      storageDepositReturnAddress: address.bech32,
    });
    const creditSnapQuery = build5Db()
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
      IgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION,
    );
  });
});

const saveOrder = async (wallet: Wallet) => {
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const data = <Transaction>{
    type: TransactionType.ORDER,
    project: SOON_PROJECT_ID,
    uid: getRandomEthAddress(),
    member: getRandomEthAddress(),
    space: getRandomEthAddress(),
    createdOn: serverTime(),
    network: Network.RMS,
    payload: {
      type: TransactionPayloadType.SELL_TOKEN,
      amount: generateRandomAmount(),
      targetAddress: targetAddress.bech32,
      validationType: TransactionValidationType.ADDRESS,
    },
  };
  await build5Db().doc(`${COL.TRANSACTION}/${data.uid}`).create(data);
  return data;
};
