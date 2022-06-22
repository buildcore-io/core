/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from 'firebase-functions';
import { WEN_FUNC } from '../../interfaces/functions';
import { Network } from '../../interfaces/models';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { MilestoneTransaction } from '../../interfaces/models/milestone';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { ProcessingService } from '../services/payment/payment-processing';
import { SmrWallet } from '../services/wallet/SmrWalletService';
import { isProdEnv } from '../utils/config.utils';
import { serverTime } from '../utils/dateTime.utils';

const handleMilestoneTransactionWrite = (network: Network) => async (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
  if (!change.after.data()) {
    return
  }
  return admin.firestore().runTransaction(async (transaction) => {
    const data = await getMilestoneTransactionData(transaction, network, change)
    if (!data.processed) {
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

const getMilestoneTransactionData = async (
  transaction: admin.firestore.Transaction,
  network: Network,
  change: functions.Change<functions.firestore.DocumentSnapshot>
) => {
  const data = (await transaction.get(change.after.ref)).data() as any

  if (network === Network.IOTA || network === Network.ATOI) {
    return <MilestoneTransaction>data
  }

  const smrWallet = new SmrWallet(network === Network.RMS)
  const outputs = []
  for (const output of data.payload.essence.outputs) {
    const address = await smrWallet.pubKeyHashToBech(getPubHashKey(output))
    outputs.push({ amount: Number(output.amount), address })
  }
  const input = await smrWallet.output(data.payload.essence.inputs[0].transactionId)
  const fromAddress = await smrWallet.pubKeyHashToBech(getPubHashKey(input.output))

  return {
    createdOn: data.createdOn,
    messageId: data.blockId,
    milestone: data.milestone,
    inputs: outputs.filter(o => o.address === fromAddress),
    outputs,
    processed: data.processed
  }
}

const getPubHashKey = (output: any) => output.unlockConditions[0].address.pubKeyHash

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
