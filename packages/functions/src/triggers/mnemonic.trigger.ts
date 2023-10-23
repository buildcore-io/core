import { build5Db } from '@build-5/database';
import { COL, MAX_WALLET_RETRY, Mnemonic, NetworkAddress, Transaction } from '@build-5/interfaces';
import { chunk, isEmpty } from 'lodash';
import { FirestoreDocEvent } from './common';
import {
  CREDIT_EXECUTABLE_TRANSACTIONS,
  DEFAULT_EXECUTABLE_TRANSACTIONS,
} from './transaction-trigger/transaction.trigger';

enum FieldNameType {
  SOURCE_ADDRESS = 'payload.sourceAddress',
  STORAGE_DEP_ADDRESS = 'payload.storageDepositSourceAddress',
  ALIAS_GOV_ADDRESS = 'payload.aliasGovAddress',
}

export const onMnemonicUpdated = async (event: FirestoreDocEvent<Mnemonic>) => {
  const { prev, curr } = event;
  if (!prev || !curr || isEmpty(prev?.lockedBy) || !isEmpty(curr?.lockedBy)) {
    return;
  }

  const address = event.docId;
  const tranId = await getUncofirmedTransactionsId(address);

  if (!isEmpty(tranId)) {
    await build5Db()
      .doc(`${COL.TRANSACTION}/${tranId}`)
      .update({ shouldRetry: true, 'payload.walletReference.inProgress': false });
  }
};

const TYPE_CHUNKS = chunk(DEFAULT_EXECUTABLE_TRANSACTIONS, 10).concat([
  CREDIT_EXECUTABLE_TRANSACTIONS,
]);

const getUncofirmedTransactionsId = async (address: NetworkAddress) => {
  for (const fieldName of Object.values(FieldNameType)) {
    for (const chunk of TYPE_CHUNKS) {
      const transactions = await build5Db()
        .collection(COL.TRANSACTION)
        .where(fieldName, '==', address)
        .where('type', 'in', chunk)
        .where('payload.walletReference.chainReference', '==', null)
        .where('payload.walletReference.count', '<', MAX_WALLET_RETRY)
        .limit(1)
        .get<Transaction>();
      if (transactions.length) {
        return transactions[0].uid;
      }
    }
  }
  return undefined;
};
