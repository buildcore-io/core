import { ITransactionPayload } from '@iota/iota.js';
import { ITransactionPayload as ITransactionPayloadNext } from '@iota/iota.js-next';
import { Converter } from '@iota/util.js';
import { Converter as ConverterNext } from '@iota/util.js-next';
import { COL, Network, Transaction, WEN_FUNC } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { soonDb } from '../../firebase/firestore/soondb';
import { scale } from '../../scale.settings';
import { IotaWallet } from '../../services/wallet/IotaWalletService';
import { WalletService } from '../../services/wallet/wallet';

export const milestoneTriggerConfig = {
  timeoutSeconds: 300,
  minInstances: scale(WEN_FUNC.milestoneTransactionWrite),
};

export const confirmTransaction = async (
  milestoneTransactionPath: string,
  milestoneTransaction: Record<string, unknown>,
  network: Network,
) => {
  const transactionId = await getMilestoneTransactionId(milestoneTransaction, network);
  if (isEmpty(transactionId)) {
    return;
  }
  const docRef = soonDb().doc(`${COL.TRANSACTION}/${transactionId}`);
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
};

export const unclockMnemonic = async (address: string) => {
  if (isEmpty(address)) {
    return;
  }
  await soonDb().doc(`${COL.MNEMONIC}/${address}`).update({
    lockedBy: '',
    consumedOutputIds: [],
    consumedNftOutputIds: [],
    consumedAliasOutputIds: [],
  });
};

const getMilestoneTransactionId = (data: Record<string, unknown>, network: Network) => {
  switch (network) {
    case Network.IOTA:
    case Network.ATOI:
      return getMilestoneTransactionIdForIota(data, network);
    default:
      return getMilestoneTransactionIdForSmr(data);
  }
};

export const getMilestoneTransactionIdForSmr = async (
  milestoneTransaction: Record<string, unknown>,
) => {
  try {
    const payload = <ITransactionPayloadNext>milestoneTransaction.payload;
    const hexData = payload.essence?.payload?.data || '';
    const metadata = JSON.parse(ConverterNext.hexToUtf8(hexData));
    return (metadata.tranId || '') as string;
  } catch (e) {
    return '';
  }
};

const getMilestoneTransactionIdForIota = async (
  milestoneTransaction: Record<string, unknown>,
  network: Network,
) => {
  try {
    const wallet = (await WalletService.newWallet(network)) as IotaWallet;
    const messageId = (milestoneTransaction.messageId as string) || '';
    const message = await wallet.client.message(messageId);
    const hexData = (message.payload as ITransactionPayload).essence.payload?.data || '';
    const metadata = JSON.parse(Converter.hexToUtf8(hexData) || '{}');
    return (metadata.tranId || '') as string;
  } catch (e) {
    return '';
  }
};
