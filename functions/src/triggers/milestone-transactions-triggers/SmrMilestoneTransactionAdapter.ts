import { BASIC_OUTPUT_TYPE, IBasicOutput, IUTXOInput, OutputTypes } from "@iota/iota.js-next"
import { Network } from "../../../interfaces/models"
import { MilestoneTransaction } from "../../../interfaces/models/milestone"
import admin from "../../admin.config"
import { SmrWallet } from "../../services/wallet/SmrWalletService"
import { WalletService } from "../../services/wallet/wallet"

export class SmrMilestoneTransactionAdapter {

  constructor(private readonly network: Network) { }

  public toMilestoneTransaction = async (data: admin.firestore.DocumentData): Promise<MilestoneTransaction> => {
    const smrWallet = WalletService.newWallet(this.network) as SmrWallet
    const smrOutputs = (data.payload.essence.outputs as OutputTypes[]).filter(o => o.type === BASIC_OUTPUT_TYPE).map(o => <IBasicOutput>o)
    const outputs = []
    for (const output of smrOutputs) {
      const address = await smrWallet.bechAddressFromOutput(output)
      outputs.push({ amount: Number(output.amount), address })
    }
    const input = <IUTXOInput>data.payload.essence.inputs[0]
    const inputOutput = await smrWallet.getTransactionOutput(input.transactionId, input.transactionOutputIndex)
    const fromAddress = await smrWallet.bechAddressFromOutput(inputOutput.output as IBasicOutput)
    return {
      createdOn: data.createdOn,
      messageId: data.blockId,
      milestone: data.milestone,
      inputs: outputs.filter(o => o.address === fromAddress),
      outputs,
      processed: data.processed
    }
  }

}

