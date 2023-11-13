import { build5Db } from '@build-5/database';
import { COL, Mnemonic, NetworkAddress, Transaction } from '@build-5/interfaces';
import { isEmpty } from 'lodash';
import { FirestoreDocEvent } from './common';

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

const MAX_COUNT = [0, 1, 2, 3, 4, 5];

const getUncofirmedTransactionsId = async (address: NetworkAddress) => {
  const transactions = await build5Db()
    .collection(COL.TRANSACTION)
    .or(Object.values(FieldNameType).map((fieldPath) => ({ fieldPath, value: address })))
    .where('payload.walletReference.confirmed', '==', false)
    .where('payload.walletReference.count', 'in', MAX_COUNT)
    .limit(1)
    .get<Transaction>();
  if (transactions.length) {
    return transactions[0].uid;
  }
  return undefined;
};
