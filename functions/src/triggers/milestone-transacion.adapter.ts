import { Network } from "../../interfaces/models";
import { MilestoneTransaction } from "../../interfaces/models/milestone";
import admin from "../admin.config";
import { SmrWallet } from "../services/wallet/SmrWalletService";

export class MilestoneTransactionAdapterServive {
  public static new = (network: Network) => {
    switch (network) {
      case Network.IOTA:
        return new IotaMilestoneTransactionAdapter()
      case Network.ATOI:
        return new IotaMilestoneTransactionAdapter()
      case Network.SMR:
        return new SmrMilestoneTransactionAdapter(false)
      case Network.RMS:
        return new SmrMilestoneTransactionAdapter(true)
    }
  }
}

interface MilestoneTransactionAdapter {
  toMilestoneTransaction: (data: admin.firestore.DocumentData) => Promise<MilestoneTransaction>;
}

class IotaMilestoneTransactionAdapter implements MilestoneTransactionAdapter {
  public toMilestoneTransaction = async (data: admin.firestore.DocumentData) => <MilestoneTransaction>data;
}

class SmrMilestoneTransactionAdapter implements MilestoneTransactionAdapter {

  constructor(private readonly testMode: boolean) { }

  public toMilestoneTransaction = async (data: admin.firestore.DocumentData) => {
    const smrWallet = new SmrWallet(this.testMode)
    const outputs = []
    for (const output of data.payload.essence.outputs) {
      const address = await smrWallet.pubKeyHashToBech(this.getPubHashKey(output))
      outputs.push({ amount: Number(output.amount), address })
    }
    const input = await smrWallet.output(data.payload.essence.inputs[0].transactionId)
    const fromAddress = await smrWallet.pubKeyHashToBech(this.getPubHashKey(input.output))

    return {
      createdOn: data.createdOn,
      messageId: data.blockId,
      milestone: data.milestone,
      inputs: outputs.filter(o => o.address === fromAddress),
      outputs,
      processed: data.processed
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getPubHashKey = (output: any) => output.unlockConditions[0].address.pubKeyHash
}

