import { MilestoneTransaction, MilestoneTransactionEntry, Network } from '@build-5/interfaces';
import {
  BASIC_OUTPUT_TYPE,
  Bech32Helper,
  ED25519_ADDRESS_TYPE,
  Ed25519Address,
  IBasicOutput,
  INftOutput,
  ISignatureUnlock,
  IUTXOInput,
  NFT_OUTPUT_TYPE,
  OutputTypes,
  SIGNATURE_UNLOCK_TYPE,
  TransactionHelper,
  UnlockTypes,
} from '@iota/iota.js-next';
import { Converter, HexHelper } from '@iota/util.js-next';
import { SmrWallet } from '../../services/wallet/SmrWalletService';
import { WalletService } from '../../services/wallet/wallet';
import { indexToString } from '../../utils/block.utils';
import { getTransactionPayloadHex } from '../../utils/smr.utils';
import { getMilestoneTransactionIdForSmr } from './common';

const VALID_OUTPUTS_TYPES = [BASIC_OUTPUT_TYPE, NFT_OUTPUT_TYPE];
type VALID_OUTPUT = IBasicOutput | INftOutput;

export class SmrMilestoneTransactionAdapter {
  constructor(private readonly network: Network) {}

  public toMilestoneTransaction = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>,
  ): Promise<MilestoneTransaction> => {
    const smrWallet = (await WalletService.newWallet(this.network)) as SmrWallet;
    const smrOutputs = (data.payload.essence.outputs as OutputTypes[])
      .filter((o) => VALID_OUTPUTS_TYPES.includes(o.type))
      .map((o) => <VALID_OUTPUT>o);

    const outputs: MilestoneTransactionEntry[] = [];
    for (let i = 0; i < smrOutputs.length; ++i) {
      if (!VALID_OUTPUTS_TYPES.includes(smrOutputs[i].type)) {
        continue;
      }
      const smrOutput = <VALID_OUTPUT>smrOutputs[i];
      const address = await smrWallet.bechAddressFromOutput(smrOutput);
      const output: MilestoneTransactionEntry = {
        amount: Number(smrOutput.amount),
        address,
        nativeTokens: smrOutput.nativeTokens || [],
        unlockConditions: smrOutput.unlockConditions,
        outputId: getTransactionPayloadHex(data.payload) + indexToString(i),
      };
      if (smrOutput.type === NFT_OUTPUT_TYPE) {
        output.nftOutput = smrOutput;
      } else if (smrOutput.type === BASIC_OUTPUT_TYPE) {
        output.output = smrOutput;
      }
      outputs.push(output);
    }

    const inputs: MilestoneTransactionEntry[] = [];
    const unlocks = data.payload.unlocks as UnlockTypes[];
    const utxoInputs = data.payload.essence.inputs as IUTXOInput[];
    for (let i = 0; i < utxoInputs.length; ++i) {
      const input = utxoInputs[i];
      const output = (
        await smrWallet.getTransactionOutput(input.transactionId, input.transactionOutputIndex)
      ).output;
      if (!VALID_OUTPUTS_TYPES.includes(output.type)) {
        continue;
      }
      let unlock = unlocks[Math.min(i, unlocks.length - 1)] as UnlockTypes;
      while (unlock.type !== SIGNATURE_UNLOCK_TYPE) {
        unlock = unlocks[unlock.reference];
      }
      const senderPublicKey = (<ISignatureUnlock>unlock).signature.publicKey;
      const pubKeyBytes = Converter.hexToBytes(HexHelper.stripPrefix(senderPublicKey));
      const walletEd25519Address = new Ed25519Address(pubKeyBytes);
      const walletAddress = walletEd25519Address.toAddress();
      const senderBech32 = Bech32Helper.toBech32(
        ED25519_ADDRESS_TYPE,
        walletAddress,
        smrWallet.info.protocol.bech32Hrp,
      );
      const consumedOutputId = TransactionHelper.outputIdFromTransactionData(
        input.transactionId,
        input.transactionOutputIndex,
      );
      inputs.push({
        amount: Number(output.amount),
        address: senderBech32,
        outputId: consumedOutputId,
      });
    }

    const build5TransactionId = await getMilestoneTransactionIdForSmr(data);

    return {
      uid: data.uid,
      createdOn: data.createdOn,
      messageId: data.blockId,
      milestone: data.milestone,
      inputs,
      outputs,
      processed: data.processed,
      build5TransactionId: build5TransactionId || undefined,
    };
  };
}
