import {
  COL,
  MAX_WALLET_RETRY,
  Network,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
} from '@build-5/interfaces';
import { ITransactionPayload } from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { build5Db } from '../src/firebase/firestore/build5Db';
import { Wallet } from '../src/services/wallet/wallet';
import { generateRandomAmount } from '../src/utils/common.utils';
import { dateToTimestamp, serverTime } from '../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../src/utils/wallet.utils';
import { wait } from '../test/controls/common';
import { getWallet } from '../test/set-up';

export const addValidatedAddress = async (network: Network, member: string) => {
  const walletService = await getWallet(network);
  const address = await walletService.getNewIotaAddressDetails();
  await build5Db()
    .doc(`${COL.MEMBER}/${member}`)
    .update({ [`validatedAddress.${network}`]: address.bech32 });
  return address;
};

export const awaitTransactionConfirmationsForToken = async (token: string) => {
  const query = build5Db()
    .collection(COL.TRANSACTION)
    .where('payload.token', '==', token)
    .where('type', 'in', [TransactionType.CREDIT, TransactionType.BILL_PAYMENT]);
  await wait(async () => {
    const transactions = (await query.get()).map((d) => <Transaction>d);
    const hasErrors = transactions.filter((t) => {
      t.payload?.walletReference?.error ||
        t.payload?.walletReference?.count! > MAX_WALLET_RETRY ||
        (!t.payload?.walletReference?.chainReference &&
          !isEmpty(t.payload?.walletReference?.chainReferences));
    });
    if (!isEmpty(hasErrors)) {
      throw Error('Transaction failed:' + JSON.stringify(hasErrors));
    }
    const allConfirmed = transactions.reduce(
      (acc, act) => acc && act.payload?.walletReference?.confirmed!,
      true,
    );
    return allConfirmed;
  }, 1800);
  const transactions = (await query.get()).map((d) => <Transaction>d);
  const allConfirmed = transactions.reduce(
    (acc, act) => acc && act.payload?.walletReference?.confirmed!,
    true,
  );
  expect(allConfirmed).toBe(true);
};

const tangleOrders: { [key: string]: Transaction } = {};
export const getTangleOrder = async (network: Network) => {
  if (tangleOrders[network]) {
    return tangleOrders[network];
  }
  const walletService = await getWallet(network);
  const targetAddress = await walletService.getNewIotaAddressDetails();
  const order = {
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    network: network,
    createdOn: serverTime(),
    payload: {
      type: TransactionPayloadType.TANGLE_REQUEST,
      amount: generateRandomAmount(),
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs().add(100, 'y')),
      validationType: TransactionValidationType.ADDRESS,
      reconciled: false,
      void: false,
      chainReference: null,
    },
    linkedTransactions: [],
  };
  await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
  tangleOrders[network] = order;
  return tangleOrders[network];
};

export const getRmsSoonTangleResponse = async (doc: Transaction, wallet: Wallet) => {
  const blockId = doc?.payload?.walletReference?.chainReference!;
  const block = await wallet!.client.block(blockId);
  const hexData = (<ITransactionPayload>block.payload)?.essence?.payload?.data || '';
  const { response } = JSON.parse(Converter.hexToUtf8(hexData));
  return response;
};
