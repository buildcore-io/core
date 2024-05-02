import { PgMnemonic, build5Db } from '@build-5/database';
import { COL, MAX_WALLET_RETRY, NetworkAddress } from '@build-5/interfaces';
import { chunk, isEmpty } from 'lodash';
import { PgDocEvent } from './common';
import {
  CREDIT_EXECUTABLE_TRANSACTIONS,
  DEFAULT_EXECUTABLE_TRANSACTIONS,
} from './transaction-trigger/transaction.trigger';

export const onMnemonicUpdated = async (event: PgDocEvent<PgMnemonic>) => {
  const { prev, curr } = event;
  if (!prev || !curr || isEmpty(prev?.lockedBy) || !isEmpty(curr?.lockedBy)) {
    return;
  }

  const address = event.uid;
  const tranId = await getUncofirmedTransactionsId(address);

  if (!isEmpty(tranId)) {
    await build5Db()
      .doc(COL.TRANSACTION, tranId!)
      .update({ shouldRetry: true, payload_walletReference_inProgress: false });
  }
};

const TYPE_CHUNKS = chunk(DEFAULT_EXECUTABLE_TRANSACTIONS, 10).concat([
  CREDIT_EXECUTABLE_TRANSACTIONS,
]);

const getUncofirmedTransactionsId = async (address: NetworkAddress) => {
  for (const types of TYPE_CHUNKS) {
    const transactions = await build5Db()
      .collection(COL.TRANSACTION)
      .where('payload_walletReference_confirmed', '==', false)
      .whereIn('type', types)
      .whereOr({
        payload_sourceAddress: address,
        payload_storageDepositSourceAddress: address,
        payload_aliasGovAddress: address,
      })
      .where('payload_walletReference_count', '<', MAX_WALLET_RETRY)
      .limit(1)
      .get();
    if (transactions.length) {
      return transactions[0].uid;
    }
  }
  return undefined;
};
