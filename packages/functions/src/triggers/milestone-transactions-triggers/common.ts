import { MilestoneTransactions, build5Db } from '@build-5/database';
import { COL, NetworkAddress } from '@build-5/interfaces';
import {
  RegularTransactionEssence,
  TaggedDataPayload,
  TransactionPayload,
  hexToUtf8,
} from '@iota/sdk';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';

export const confirmTransaction = async (
  milestoneTransactionPath: string,
  milestoneTransaction: MilestoneTransactions,
) => {
  const transactionId = getMilestoneTransactionId(milestoneTransaction);
  if (isEmpty(transactionId)) {
    return;
  }
  const docRef = build5Db().doc(COL.TRANSACTION, transactionId);
  const transaction = await docRef.get();
  if (!transaction) {
    return;
  }

  await docRef.update({
    payload_walletReference_confirmed: true,
    payload_walletReference_confirmedOn: dayjs().toDate(),
    payload_walletReference_inProgress: false,
    payload_walletReference_milestoneTransactionPath: milestoneTransactionPath,
  });

  await unclockMnemonic(transaction.payload.sourceAddress);
  await unclockMnemonic(transaction.payload.storageDepositSourceAddress);
  await unclockMnemonic(transaction.payload.aliasGovAddress);
};

export const unclockMnemonic = async (address: NetworkAddress | undefined) => {
  if (isEmpty(address)) {
    return;
  }
  await build5Db().doc(COL.MNEMONIC, address!).update({
    lockedBy: '',
    consumedOutputIds: [],
    consumedNftOutputIds: [],
    consumedAliasOutputIds: [],
  });
};

export const getMilestoneTransactionId = (milestoneTransaction: MilestoneTransactions) => {
  try {
    const payload = milestoneTransaction.payload as unknown as TransactionPayload;
    const essence = payload.essence as RegularTransactionEssence;
    const hexData = (essence?.payload as TaggedDataPayload)?.data || '';
    const metadata = JSON.parse(hexToUtf8(hexData));
    return (metadata.tranId || '') as string;
  } catch (e) {
    return '';
  }
};
