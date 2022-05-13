import * as functions from 'firebase-functions';
import { WEN_FUNC } from '../../interfaces/functions';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { MilestoneTransaction } from '../../interfaces/models/milestone';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { ProcessingService } from '../services/payment/payment-processing';
import { serverTime } from '../utils/dateTime.utils';

// Listen for changes in all documents in the 'users' collection
export const milestoneTransactionWrite = functions.runWith({
  timeoutSeconds: 300,
  minInstances: scale(WEN_FUNC.milestoneTransactionWrite),
}).firestore.document(COL.MILESTONE + '/{milestoneId}/' + SUB_COL.TRANSACTIONS + '/{tranId}').onWrite((change) =>
  admin.firestore().runTransaction(async (transaction) => {
    const data = <MilestoneTransaction>(await transaction.get(change.after.ref)).data()
    if (data.processed !== true) {
      const service = new ProcessingService(transaction);
      await service.processMilestoneTransaction(data);
      service.submit();
      return transaction.update(change.after.ref, { processed: true, processedOn: serverTime() })
    } else {
      functions.logger.info('Nothing to process.');
      return;
    }
  })
);
