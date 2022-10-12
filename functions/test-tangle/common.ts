import { Network, Transaction, TransactionType } from '../interfaces/models';
import { COL } from '../interfaces/models/base';
import admin from '../src/admin.config';
import { WalletService } from '../src/services/wallet/wallet';
import { wait } from '../test/controls/common';

export const addValidatedAddress = async (network: Network, member: string) => {
  const walletService = await WalletService.newWallet(network);
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
    const allConfirmed = transactions.reduce(
      (acc, act) => acc && act.payload?.walletReference?.confirmed,
      true,
    );
    return allConfirmed;
  });
  const transactions = (await query.get()).docs.map((d) => <Transaction>d.data());
  const allConfirmed = transactions.reduce(
    (acc, act) => acc && act.payload?.walletReference?.confirmed,
    true,
  );
  expect(allConfirmed).toBe(true);
};
