import {
  COL,
  MAX_WALLET_RETRY,
  Mnemonic,
  Transaction,
  TransactionType,
  WEN_FUNC_TRIGGER,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions/v2';
import { chunk, isEmpty } from 'lodash';
import { soonDb } from '../firebase/firestore/soondb';
import { scale } from '../scale.settings';
import { EXECUTABLE_TRANSACTIONS } from './transaction-trigger/transaction.trigger';

export const mnemonicWrite = functions.firestore.onDocumentUpdated(
  {
    document: COL.MNEMONIC + '/{address}',
    minInstances: scale(WEN_FUNC_TRIGGER.mnemonicWrite),
    concurrency: 500,
  },
  async (event) => {
    const prev = <Mnemonic | undefined>event.data?.before?.data();
    const curr = <Mnemonic | undefined>event.data?.after?.data();
    if (!prev || !curr || isEmpty(prev?.lockedBy) || !isEmpty(curr?.lockedBy)) {
      return;
    }

    const address = event.params.address as string;
    const promises = Object.values(FieldNameType).map((value) =>
      getUncofirmedTransactionsByFieldName(value, address),
    );
    const transactions = (await Promise.all(promises)).reduce((acc, act) => [...acc, ...act], []);

    const tranId =
      transactions.find((doc) => doc.type !== TransactionType.CREDIT)?.uid ||
      transactions.find((doc) => doc.type === TransactionType.CREDIT)?.uid;
    if (!isEmpty(tranId)) {
      await soonDb()
        .doc(`${COL.TRANSACTION}/${tranId}`)
        .update({ shouldRetry: true, 'payload.walletReference.inProgress': false });
    }
  },
);

const getUncofirmedTransactionsByFieldName = async (fieldName: FieldNameType, address: string) => {
  const promises = chunk(EXECUTABLE_TRANSACTIONS, 10).map((chunk) =>
    soonDb()
      .collection(COL.TRANSACTION)
      .where(fieldName, '==', address)
      .where('type', 'in', chunk)
      .where('payload.walletReference.chainReference', '==', null)
      .where('payload.walletReference.count', '<', MAX_WALLET_RETRY)
      .get<Transaction>(),
  );
  return (await Promise.all(promises)).reduce((acc, act) => [...acc, ...act], []);
};

enum FieldNameType {
  SOURCE_ADDRESS = 'payload.sourceAddress',
  STORAGE_DEP_ADDRESS = 'payload.storageDepositSourceAddress',
  ALIAS_GOV_ADDRESS = 'payload.aliasGovAddress',
}
