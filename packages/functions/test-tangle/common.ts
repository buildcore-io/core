import {
  COL,
  MAX_WALLET_RETRY,
  Network,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import { isEmpty } from 'lodash';
import admin from '../src/admin.config';
import { wait } from '../test/controls/common';
import { getWallet } from '../test/set-up';

export const addValidatedAddress = async (network: Network, member: string) => {
  const walletService = await getWallet(network);
  const address = await walletService.getNewIotaAddressDetails();
  await admin
    .firestore()
    .doc(`${COL.MEMBER}/${member}`)
    .update({ [`validatedAddress.${network}`]: address.bech32 });
  return address;
};

export const awaitTransactionConfirmationsForToken = async (token: string) => {
  const query = admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('payload.token', '==', token)
    .where('type', 'in', [TransactionType.CREDIT, TransactionType.BILL_PAYMENT]);
  await wait(async () => {
    const transactions = (await query.get()).docs.map((d) => <Transaction>d.data());
    const hasErrors = transactions.filter((t) => {
      t.payload?.walletReference?.error ||
        t.payload?.walletReference?.count > MAX_WALLET_RETRY ||
        (!t.payload?.walletReference?.chainReference &&
          !isEmpty(t.payload?.walletReference?.chainReferences));
    });
    if (!isEmpty(hasErrors)) {
      throw Error('Transaction failed:' + JSON.stringify(hasErrors));
    }
    const allConfirmed = transactions.reduce(
      (acc, act) => acc && act.payload?.walletReference?.confirmed,
      true,
    );
    return allConfirmed;
  }, 1800);
  const transactions = (await query.get()).docs.map((d) => <Transaction>d.data());
  const allConfirmed = transactions.reduce(
    (acc, act) => acc && act.payload?.walletReference?.confirmed,
    true,
  );
  expect(allConfirmed).toBe(true);
};
