import { MilestoneTransactions } from '@buildcore/database';
import { MilestoneTransaction, MilestoneTransactionEntry, Network } from '@buildcore/interfaces';
import {
  BasicOutput,
  FeatureType,
  NftOutput,
  OutputType,
  RegularTransactionEssence,
  SignatureUnlock,
  TagFeature,
  TransactionPayload,
  UTXOInput,
  UnlockType,
  Utils,
} from '@iota/sdk';
import { WalletService } from '../../services/wallet/wallet.service';
import { getMilestoneTransactionId } from './common';

const VALID_OUTPUTS_TYPES = [OutputType.Basic, OutputType.Nft];
type VALID_OUTPUT = BasicOutput | NftOutput;

export class MilestoneTransactionAdapter {
  constructor(private readonly network: Network) {}

  public toMilestoneTransaction = async (
    data: MilestoneTransactions,
  ): Promise<MilestoneTransaction> => {
    const wallet = await WalletService.newWallet(this.network);
    const payload = data.payload as unknown as TransactionPayload;
    const essence = payload.essence as RegularTransactionEssence;
    const outputs = essence.outputs
      .filter((o) => VALID_OUTPUTS_TYPES.includes(o.type))
      .map((o) => <VALID_OUTPUT>o);

    const entries: MilestoneTransactionEntry[] = [];
    for (let i = 0; i < outputs.length; ++i) {
      if (!VALID_OUTPUTS_TYPES.includes(outputs[i].type)) {
        continue;
      }
      const output = <VALID_OUTPUT>outputs[i];
      const address = wallet.bechAddressFromOutput(output);
      const tag = output.features?.find((f) => f.type === FeatureType.Tag) as
        | TagFeature
        | undefined;
      const entry: MilestoneTransactionEntry = {
        amount: Number(output.amount),
        address,
        nativeTokens: output.nativeTokens || [],
        unlockConditions: output.unlockConditions,
        outputId: Utils.computeOutputId(Utils.transactionId(payload), i),
        tag: tag?.tag,
      };
      if (output.type === OutputType.Nft) {
        entry.nftOutput = output;
      } else if (output.type === OutputType.Basic) {
        entry.output = output;
      }
      entries.push(entry);
    }

    const fromAddresses: string[] = [];
    const unlocks = payload.unlocks.filter((u) => u.type === UnlockType.Signature);
    for (const unlock of unlocks) {
      const senderBech32 = Utils.hexPublicKeyToBech32Address(
        (<SignatureUnlock>unlock).signature.publicKey,
        wallet.info.protocol.bech32Hrp,
      );
      fromAddresses.push(senderBech32);
    }

    const buildcoreTransactionId = getMilestoneTransactionId(data);

    const consumedOutputIds = essence.inputs.map((i) => {
      const { transactionId, transactionOutputIndex } = i as UTXOInput;
      return Utils.computeOutputId(transactionId, transactionOutputIndex);
    });

    return {
      uid: data.uid as string,
      createdOn: data.createdOn!,
      messageId: data.blockId as string,
      milestone: data.milestone!,
      consumedOutputIds,
      fromAddresses,
      outputs: entries,
      processed: data.processed as boolean,
      buildcoreTransactionId: buildcoreTransactionId || undefined,
    };
  };
}
