import { COL, Transaction } from '@build-5/interfaces';
import {
  RegularTransactionEssence,
  TaggedDataPayload,
  TransactionPayload,
  hexToUtf8,
} from '@iota/sdk';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { build5Db } from '../../firebase/firestore/build5Db';

export const confirmTransaction = async (
  milestoneTransactionPath: string,
  milestoneTransaction: Record<string, unknown>,
) => {
  const transactionId = await getMilestoneTransactionId(milestoneTransaction);
  if (isEmpty(transactionId)) {
    return;
  }
  const docRef = build5Db().doc(`${COL.TRANSACTION}/${transactionId}`);
  const transaction = await docRef.get<Transaction>();
  if (!transaction) {
    return;
  }

  await docRef.update({
    'payload.walletReference.confirmed': true,
    'payload.walletReference.confirmedOn': dayjs().toDate(),
    'payload.walletReference.inProgress': false,
    'payload.walletReference.milestoneTransactionPath': milestoneTransactionPath,
  });

  await unclockMnemonic(transaction.payload.sourceAddress);
  await unclockMnemonic(transaction.payload.storageDepositSourceAddress);
  await unclockMnemonic(transaction.payload.aliasGovAddress);
};

export const unclockMnemonic = async (address: string | undefined) => {
  if (isEmpty(address)) {
    return;
  }
  await build5Db().doc(`${COL.MNEMONIC}/${address}`).update({
    lockedBy: '',
    consumedOutputIds: [],
    consumedNftOutputIds: [],
    consumedAliasOutputIds: [],
  });
};

export const getMilestoneTransactionId = async (milestoneTransaction: Record<string, unknown>) => {
  try {
    const payload = <TransactionPayload>milestoneTransaction.payload;
    const essence = payload.essence as RegularTransactionEssence;
    const hexData = (essence?.payload as TaggedDataPayload)?.data || '';
    const metadata = JSON.parse(hexToUtf8(hexData));
    return (metadata.tranId || '') as string;
  } catch (e) {
    return '';
  }
};
