import { ConflictReason, CONFLICT_REASON_STRINGS, FOUNDRY_OUTPUT_TYPE, IAliasAddress, IFoundryOutput, IImmutableAliasUnlockCondition, IMetadataFeature, IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE, METADATA_FEATURE_TYPE, OutputTypes, TransactionHelper } from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import * as functions from 'firebase-functions';
import { Network, TokenStatus } from '../../../interfaces/models';
import { COL, SUB_COL } from '../../../interfaces/models/base';
import admin from '../../admin.config';
import { ProcessingService } from '../../services/payment/payment-processing';
import { serverTime } from '../../utils/dateTime.utils';
import { milestoneTriggerConfig } from './common';
import { SmrMilestoneTransactionAdapter } from './SmrMilestoneTransactionAdapter';

const handleMilestoneTransactionWrite = (network: Network) => async (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
  if (!change.after.data()) {
    return
  }
  return admin.firestore().runTransaction(async (transaction) => {
    const data = (await transaction.get(change.after.ref)).data()!
    const adapter = new SmrMilestoneTransactionAdapter(network)
    const milestoneTransaction = await adapter.toMilestoneTransaction(change.after.id, data)
    if (milestoneTransaction.processed) {
      functions.logger.info('Nothing to process.');
      return;
    }

    const service = new ProcessingService(transaction);
    await service.processMilestoneTransactions(milestoneTransaction);
    service.submit();

    await handleFoundryOutput(transaction, data);

    return transaction.update(change.after.ref, { processed: true, processedOn: serverTime() })
  })
}

const handleFoundryOutput = async (transaction: admin.firestore.Transaction, data: admin.firestore.DocumentData, isConflict = false) => {
  const outputs = (data.payload.essence.outputs as OutputTypes[])
    .filter(o => o.type === FOUNDRY_OUTPUT_TYPE)
    .map(o => <IFoundryOutput>o)
  for (const output of outputs) {
    const metadata = <IMetadataFeature | undefined>output.immutableFeatures?.find(f => f.type === METADATA_FEATURE_TYPE)
    if (!metadata) {
      return
    }
    const symbol = JSON.parse(Converter.hexToUtf8(metadata.data)).symbol as string
    const snap = await admin.firestore().collection(COL.TOKEN).where('symbol', '==', symbol.toUpperCase()).get()
    const aliasUnclock = <IImmutableAliasUnlockCondition>output.unlockConditions.find(uc => uc.type === IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE)
    const aliasId = (<IAliasAddress>aliasUnclock.address).aliasId
    const tokenId = TransactionHelper.constructTokenId(aliasId, output.serialNumber, output.tokenScheme.type);

    for (const doc of snap.docs) {
      transaction.update(admin.firestore().doc(`${COL.TOKEN}/${doc.id}`), {
        'mintingData.tokenId': tokenId,
        'mintingData.aliasId': aliasId,
        'mintingData.blockId': data.blockId,
        status: isConflict ? TokenStatus.MINTING_ERROR : TokenStatus.MINTED
      })
    }
  }
}

export const smrMilestoneTransactionWrite = functions.runWith(milestoneTriggerConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.SMR}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`)
  .onWrite(handleMilestoneTransactionWrite(Network.SMR));

export const rmsMilestoneTransactionWrite = functions.runWith(milestoneTriggerConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.RMS}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`)
  .onWrite(handleMilestoneTransactionWrite(Network.RMS));


const handleMilestoneTransactionConflictWrite = async (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
  const data = change.after.data()!
  const blockId: string = data.blockId || ''
  const conflictReason = <ConflictReason | undefined>data.conflictReason
  const snap = await admin.firestore()
    .collection(COL.TRANSACTION)
    .where('payload.walletReference.chainReference', '==', blockId)
    .get()

  for (const doc of snap.docs) {
    doc.ref.update({
      'payload.walletReference.chainReference': null,
      'payload.walletReference.error': conflictReason ? CONFLICT_REASON_STRINGS[conflictReason] : null
    })
  }

  await admin.firestore().runTransaction((transaction) => handleFoundryOutput(transaction, data, true))
}

export const smrMilestoneTransactionConflictWrite = functions.runWith(milestoneTriggerConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.SMR}/{milestoneId}/${SUB_COL.TRANSACTIONS_CONFLICT}/{tranId}`)
  .onWrite(handleMilestoneTransactionConflictWrite);

export const rmsMilestoneTransactionConflictWrite = functions.runWith(milestoneTriggerConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.RMS}/{milestoneId}/${SUB_COL.TRANSACTIONS_CONFLICT}/{tranId}`)
  .onWrite(handleMilestoneTransactionConflictWrite);
