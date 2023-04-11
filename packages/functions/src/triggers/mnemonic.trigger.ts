import {
  COL,
  MAX_WALLET_RETRY,
  Mnemonic,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { isEmpty } from 'lodash';
import { soonDb } from '../firebase/firestore/soondb';
import { scale } from '../scale.settings';
import { EXECUTABLE_TRANSACTIONS } from './transaction-trigger/transaction.trigger';

export const mnemonicWrite = functions
  .runWith({
    timeoutSeconds: 540,
    minInstances: scale(WEN_FUNC.mnemonicWrite),
    memory: '512MB',
  })
  .firestore.document(COL.MNEMONIC + '/{address}')
  .onUpdate(async (change, context) => {
    const prev = <Mnemonic | undefined>change.before.data();
    const curr = <Mnemonic | undefined>change.after.data();
    if (!prev || !curr || isEmpty(prev?.lockedBy) || !isEmpty(curr?.lockedBy)) {
      return;
    }

    const address = context.params.address as string;
    const sourceAddressTrans = await getUncofirmedTransactionsByFieldName(
      'payload.sourceAddress',
      address,
    );
    const storageDepositAddressTrans = await getUncofirmedTransactionsByFieldName(
      'payload.storageDepositSourceAddress',
      address,
    );
    const transactions = [...sourceAddressTrans, ...storageDepositAddressTrans];

    const tranId =
      transactions.find((doc) => doc.type !== TransactionType.CREDIT)?.uid ||
      transactions.find((doc) => doc.type === TransactionType.CREDIT)?.uid;
    if (!isEmpty(tranId)) {
      await soonDb()
        .doc(`${COL.TRANSACTION}/${tranId}`)
        .update({ shouldRetry: true, 'payload.walletReference.inProgress': false });
    }
  });

const getUncofirmedTransactionsByFieldName = (fieldName: FieldNameType, address: string) =>
  soonDb()
    .collection(COL.TRANSACTION)
    .where(fieldName, '==', address)
    .where('type', 'in', EXECUTABLE_TRANSACTIONS)
    .where('payload.walletReference.chainReference', '==', null)
    .where('payload.walletReference.count', '<', MAX_WALLET_RETRY)
    .get<Transaction>();

type FieldNameType = 'payload.sourceAddress' | 'payload.storageDepositSourceAddress';
