import { COL, Transaction, WEN_FUNC_TRIGGER } from '@build-5/interfaces';
import { ITransactionPayload } from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import dayjs from 'dayjs';
import { DocumentOptions } from 'firebase-functions/v2/firestore';
import { isEmpty } from 'lodash';
import { build5Db } from '../../firebase/firestore/build5Db';
import { scale } from '../../scale.settings';

export const milestoneTriggerConfig = {
  timeoutSeconds: 300,
  minInstances: scale(WEN_FUNC_TRIGGER.milestoneTransactionWrite),
} as DocumentOptions<string>;

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
    const payload = <ITransactionPayload>milestoneTransaction.payload;
    const hexData = payload.essence?.payload?.data || '';
    const metadata = JSON.parse(Converter.hexToUtf8(hexData));
    return (metadata.tranId || '') as string;
  } catch (e) {
    return '';
  }
};
