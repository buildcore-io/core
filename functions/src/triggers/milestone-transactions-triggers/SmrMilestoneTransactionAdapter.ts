import { BASIC_OUTPUT_TYPE, IBasicOutput, IUTXOInput, OutputTypes } from "@iota/iota.js-next"
import { Network } from "../../../interfaces/models"
import { MilestoneTransaction, MilestoneTransactionEntry } from "../../../interfaces/models/milestone"
import admin from "../../admin.config"
import { SmrWallet } from "../../services/wallet/SmrWalletService"
import { WalletService } from "../../services/wallet/wallet"

export class SmrMilestoneTransactionAdapter {

  constructor(private readonly network: Network) { }

  public toMilestoneTransaction = async (uid: string, data: admin.firestore.DocumentData): Promise<MilestoneTransaction> => {
    const smrWallet = await WalletService.newWallet(this.network) as SmrWallet
    const smrOutputs = (data.payload.essence.outputs as OutputTypes[])
      .filter(o => o.type === BASIC_OUTPUT_TYPE)
      .map(o => <IBasicOutput>o)

    const outputs: MilestoneTransactionEntry[] = []
    for (const output of smrOutputs) {
      const address = await smrWallet.bechAddressFromOutput(output)
      outputs.push({
        amount: Number(output.amount),
        address,
        nativeTokens: output.nativeTokens || [],
        unlockConditionsCount: output.unlockConditions.length
      })
    }
    
    const inputs: MilestoneTransactionEntry[] = []
    for (const input of (data.payload.essence.inputs as IUTXOInput[])) {
      const output = (await smrWallet.getTransactionOutput(input.transactionId, input.transactionOutputIndex)).output
      if (output.type === BASIC_OUTPUT_TYPE) {
        inputs.push({ amount: Number(output.amount), address: await smrWallet.bechAddressFromOutput(output) })
      }
    }

    return {
      uid,
      createdOn: data.createdOn,
      messageId: data.blockId,
      milestone: data.milestone,
      inputs,
      outputs,
      processed: data.processed
    }
  }

}

