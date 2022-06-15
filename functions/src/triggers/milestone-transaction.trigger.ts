import * as functions from 'firebase-functions';
import { WEN_FUNC } from '../../interfaces/functions';
import { Network } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { MilestoneTransaction } from '../../interfaces/models/milestone';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { ProcessingService } from '../services/payment/payment-processing';
import { isProdEnv } from '../utils/config.utils';
import { serverTime } from '../utils/dateTime.utils';

const handleMilestoneTransactionWrite = async (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
  if (!change.after.data()) {
    return
  }
  return admin.firestore().runTransaction(async (transaction) => {
    const data = <MilestoneTransaction>(await transaction.get(change.after.ref)).data()
    if (data.processed !== true) {
      const service = new ProcessingService(transaction);
      await service.processMilestoneTransactions(data);
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
  .onWrite(handleMilestoneTransactionWrite);

const iotaTestMilestoneTransactionWrite = functions.runWith(functionConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.IOTA_TEST}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`)
  .onWrite(handleMilestoneTransactionWrite);

const shimmerMilestoneTransactionWrite = functions.runWith(functionConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.SHIMMER}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`)
  .onWrite(handleMilestoneTransactionWrite);

const shimmerTestMilestoneTransactionWrite = functions.runWith(functionConfig)
  .firestore.document(`${COL.MILESTONE}_${Network.SHIMMER_TEST}/{milestoneId}/${SUB_COL.TRANSACTIONS}/{tranId}`)
  .onWrite(handleMilestoneTransactionWrite);

const prodMilestoneTriggers = {
  iotaMilestoneTransactionWrite,
  shimmerMilestoneTransactionWrite
}

const testMilestoneTriggers = {
  iotaTestMilestoneTransactionWrite,
  shimmerTestMilestoneTransactionWrite
}

export const milestoneTriggers = isProdEnv() ? prodMilestoneTriggers : { ...prodMilestoneTriggers, ...testMilestoneTriggers }
