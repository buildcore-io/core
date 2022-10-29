import { ITransactionPayload } from '@iota/iota.js';
import { IBlock, ITransactionPayload as ITransactionPayloadNext } from '@iota/iota.js-next';
import { Converter } from '@iota/util.js';
import { Converter as ConverterNext } from '@iota/util.js-next';
import { COL, Network, Transaction, WEN_FUNC } from '@soon/interfaces';
import { isEmpty } from 'lodash';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { IotaWallet } from '../../services/wallet/IotaWalletService';
import { WalletService } from '../../services/wallet/wallet';
import { uOn } from '../../utils/dateTime.utils';

export const milestoneTriggerConfig = {
  timeoutSeconds: 300,
  minInstances: scale(WEN_FUNC.milestoneTransactionWrite),
};

export const confirmTransaction = async (
  doc: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>,
  network: Network,
) => {
  const transactionId = await getMilestoneTransactionId(doc.data()!, network);
  if (isEmpty(transactionId)) {
    return;
  }
  const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${transactionId}`);
  const transaction = <Transaction | undefined>(await docRef.get()).data();
  if (!transaction) {
    return;
  }

  await docRef.update(
    uOn({
      'payload.walletReference.confirmed': true,
      'payload.walletReference.confirmedOn': admin.firestore.FieldValue.serverTimestamp(),
      'payload.walletReference.inProgress': false,
      'payload.walletReference.milestoneTransactionPath': doc.ref.path,
    }),
  );

  await unclockMnemonic(transaction.payload.sourceAddress);
  await unclockMnemonic(transaction.payload.storageDepositSourceAddress);
};

export const unclockMnemonic = async (address: string) => {
  if (isEmpty(address)) {
    return;
  }
  await admin
    .firestore()
    .doc(`${COL.MNEMONIC}/${address}`)
    .update(
      uOn({
        lockedBy: '',
        consumedOutputIds: [],
        consumedNftOutputIds: [],
        consumedAliasOutputIds: [],
      }),
    );
};

const getMilestoneTransactionId = (data: admin.firestore.DocumentData, network: Network) => {
  switch (network) {
    case Network.IOTA:
    case Network.ATOI:
      return getMilestoneTransactionIdForIota(data, network);
    default:
      return getMilestoneTransactionIdForSmr(data);
  }
};

export const getMilestoneTransactionIdForSmr = async (
  milestoneTransaction: admin.firestore.DocumentData,
) => {
  try {
    const block = milestoneTransaction as IBlock;
    const hexData = (<ITransactionPayloadNext>block.payload)?.essence?.payload?.data || '';
    const metadata = JSON.parse(ConverterNext.hexToUtf8(hexData));
    return (metadata.tranId || '') as string;
  } catch (e) {
    return '';
  }
};

const getMilestoneTransactionIdForIota = async (
  milestoneTransaction: admin.firestore.DocumentData,
  network: Network,
) => {
  try {
    const wallet = (await WalletService.newWallet(network)) as IotaWallet;
    const messageId = milestoneTransaction.messageId || '';
    const message = await wallet.client.message(messageId);
    const hexData = (message.payload as ITransactionPayload).essence.payload?.data || '';
    const metadata = JSON.parse(Converter.hexToUtf8(hexData) || '{}');
    return (metadata.tranId || '') as string;
  } catch (e) {
    return '';
  }
};
