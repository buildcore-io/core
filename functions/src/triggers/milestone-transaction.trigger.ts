import * as functions from 'firebase-functions';
import { WEN_FUNC } from '../../interfaces/functions';
import { Network } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { ProcessingService } from '../services/payment/payment-processing';
import { isProdEnv } from '../utils/config.utils';
import { serverTime } from '../utils/dateTime.utils';
import { MilestoneTransactionAdapterServive } from './milestone-transacion.adapter';

const handleMilestoneTransactionWrite = (network: Network) => async (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
  if (!change.after.data()) {
    return
  }
  return admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(change.after.ref)
    const adapter = MilestoneTransactionAdapterServive.new(network)
    const milestoneTransaction = await adapter.toMilestoneTransaction(snapshot.data()!)
    
    if (!milestoneTransaction.processed) {
      const service = new ProcessingService(transaction);
      await service.processMilestoneTransactions(milestoneTransaction);
      service.submit();
      return transaction.update(change.after.ref, { processed: true, processedOn: serverTime() })
    } else {
      functions.logger.info('Nothing to process.');
      return;
    }
  })
}

const functionConfig = {
  timeoutSeconds: 300,
  minInstances: scale(WEN_FUNC.milestoneTransactionWrite),
}

const iotaMilestoneTransactionWrite = functions.runWith(functionConfig)
  .firestore.document(`${COL.MILESTONE}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`)
  .onWrite(handleMilestoneTransactionWrite(Network.IOTA));

const atoiMilestoneTransactionWrite = functions.runWith(functionConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.ATOI}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`)
  .onWrite(handleMilestoneTransactionWrite(Network.ATOI));

const smrMilestoneTransactionWrite = functions.runWith(functionConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.SMR}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`)
  .onWrite(handleMilestoneTransactionWrite(Network.SMR));

const rmsMilestoneTransactionWrite = functions.runWith(functionConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.RMS}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`)
  .onWrite(handleMilestoneTransactionWrite(Network.RMS));

const prodMilestoneTriggers = {
  iotaMilestoneTransactionWrite,
  smrMilestoneTransactionWrite
}

const testMilestoneTriggers = {
  atoiMilestoneTransactionWrite,
  rmsMilestoneTransactionWrite
}

export const milestoneTriggers = isProdEnv() ? prodMilestoneTriggers : { ...prodMilestoneTriggers, ...testMilestoneTriggers }
