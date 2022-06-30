import { FOUNDRY_OUTPUT_TYPE, IAliasAddress, IFoundryOutput, IImmutableAliasUnlockCondition, IMetadataFeature, IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE, METADATA_FEATURE_TYPE, OutputTypes, TransactionHelper } from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import * as functions from 'firebase-functions';
import { head } from 'lodash';
import { Network } from '../../../interfaces/models';
import { COL, SUB_COL } from '../../../interfaces/models/base';
import { TokenStatus } from '../../../interfaces/models/token';
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
    const adapter = new SmrMilestoneTransactionAdapter(network === Network.RMS)
    const milestoneTransaction = await adapter.toMilestoneTransaction(data)
    if (milestoneTransaction.processed) {
      functions.logger.info('Nothing to process.');
      return;
    }

    const service = new ProcessingService(transaction);
    await service.processMilestoneTransactions(milestoneTransaction);
    service.submit();

    const newFoundryOutput = getNewFoundryOutput(data)
    if (newFoundryOutput) {
      await updateMintedToken(transaction, newFoundryOutput, network)
    }

    return transaction.update(change.after.ref, { processed: true, processedOn: serverTime() })
  })
}

const getNewFoundryOutput = (data: admin.firestore.DocumentData) => {
  const outputs = (data.payload.essence.outputs as OutputTypes[])
    .filter(o => o.type === FOUNDRY_OUTPUT_TYPE && Number(o.tokenScheme.mintedTokens) === 0)
  return head(outputs as IFoundryOutput[])
}

const updateMintedToken = async (transaction: admin.firestore.Transaction, foundryOutput: IFoundryOutput, network: Network) => {
  const aliasUnlock = <IImmutableAliasUnlockCondition>foundryOutput.unlockConditions.find(u => u.type === IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE)
  const aliasId = (aliasUnlock.address as IAliasAddress).aliasId
  const mintedTokenId = TransactionHelper.constructTokenId(aliasId, foundryOutput.serialNumber, foundryOutput.tokenScheme.type);

  const codedMetadata = (<IMetadataFeature>foundryOutput.immutableFeatures?.find(imf => imf.type === METADATA_FEATURE_TYPE)).data
  const metadata = JSON.parse(Converter.hexToUtf8(codedMetadata))

  const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${metadata.uid}`)
  transaction.update(tokenDocRef, { status: TokenStatus.MINTED, mintedTokenId, mintedOn: serverTime(), aliasId })
}


export const smrMilestoneTransactionWrite = functions.runWith(milestoneTriggerConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.SMR}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`)
  .onWrite(handleMilestoneTransactionWrite(Network.SMR));

export const rmsMilestoneTransactionWrite = functions.runWith(milestoneTriggerConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.RMS}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`)
  .onWrite(handleMilestoneTransactionWrite(Network.RMS));
