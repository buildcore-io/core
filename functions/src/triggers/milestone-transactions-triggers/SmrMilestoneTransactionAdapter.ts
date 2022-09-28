import { BASIC_OUTPUT_TYPE, Bech32Helper, Ed25519Address, ED25519_ADDRESS_TYPE, IBasicOutput, INftOutput, ISignatureUnlock, IUTXOInput, NFT_OUTPUT_TYPE, OutputTypes, SIGNATURE_UNLOCK_TYPE, UnlockTypes } from "@iota/iota.js-next"
import { Converter, HexHelper } from "@iota/util.js-next"
import { Network } from "../../../interfaces/models"
import { MilestoneTransaction, MilestoneTransactionEntry } from "../../../interfaces/models/milestone"
import admin from "../../admin.config"
import { SmrWallet } from "../../services/wallet/SmrWalletService"
import { WalletService } from "../../services/wallet/wallet"

const VALID_OUTPUTS_TYPES = [BASIC_OUTPUT_TYPE, NFT_OUTPUT_TYPE]
type VALID_OUTPUT = IBasicOutput | INftOutput

export class SmrMilestoneTransactionAdapter {

  constructor(private readonly network: Network) { }

  public toMilestoneTransaction = async (uid: string, data: admin.firestore.DocumentData): Promise<MilestoneTransaction> => {
    const smrWallet = await WalletService.newWallet(this.network) as SmrWallet
    const smrOutputs = (data.payload.essence.outputs as OutputTypes[])
      .filter(o => VALID_OUTPUTS_TYPES.includes(o.type))
      .map(o => <VALID_OUTPUT>o)

    const outputs: MilestoneTransactionEntry[] = []
    for (const output of smrOutputs) {
      const address = await smrWallet.bechAddressFromOutput(output)
      const data: MilestoneTransactionEntry = {
        amount: Number(output.amount),
        address,
        nativeTokens: output.nativeTokens || [],
        unlockConditionsCount: output.unlockConditions.length,
      }
      if (output.type === NFT_OUTPUT_TYPE) {
        data.nftOutput = output
      }
      outputs.push(data)
    }

    const inputs: MilestoneTransactionEntry[] = []
    const unlocks = data.payload.unlocks[0] as UnlockTypes[]
    const utxoInputs = (data.payload.essence.inputs as IUTXOInput[])
    for (let i = 0; i < utxoInputs.length; ++i) {
      const input = utxoInputs[i]
      const output = (await smrWallet.getTransactionOutput(input.transactionId, input.transactionOutputIndex)).output
      if (!VALID_OUTPUTS_TYPES.includes(output.type)) {
        continue;
      }
      let unlock = data.payload.unlocks[i] as UnlockTypes
      if (unlock.type !== SIGNATURE_UNLOCK_TYPE) {
        unlock = unlocks[unlock.reference]
      }
      const senderPublicKey = (<ISignatureUnlock>unlock).signature.publicKey
      const pubKeyBytes = Converter.hexToBytes(HexHelper.stripPrefix(senderPublicKey))
      const walletEd25519Address = new Ed25519Address(pubKeyBytes);
      const walletAddress = walletEd25519Address.toAddress();
      const senderBech32 = Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, walletAddress, smrWallet.info.protocol.bech32Hrp)
      inputs.push({ amount: Number(output.amount), address: senderBech32 })
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

