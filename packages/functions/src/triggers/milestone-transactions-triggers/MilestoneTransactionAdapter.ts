import {
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Network,
  Timestamp,
} from '@build-5/interfaces';
import {
  BASIC_OUTPUT_TYPE,
  Bech32Helper,
  ED25519_ADDRESS_TYPE,
  Ed25519Address,
  IBasicOutput,
  INftOutput,
  ISignatureUnlock,
  ITransactionPayload,
  NFT_OUTPUT_TYPE,
  SIGNATURE_UNLOCK_TYPE,
  TransactionHelper,
} from '@iota/iota.js-next';
import { Converter, HexHelper } from '@iota/util.js-next';
import { WalletService } from '../../services/wallet/wallet.service';
import { indexToString } from '../../utils/block.utils';
import { getTransactionPayloadHex } from '../../utils/smr.utils';
import { getMilestoneTransactionId } from './common';

const VALID_OUTPUTS_TYPES = [BASIC_OUTPUT_TYPE, NFT_OUTPUT_TYPE];
type VALID_OUTPUT = IBasicOutput | INftOutput;

export class MilestoneTransactionAdapter {
  constructor(private readonly network: Network) {}

  public toMilestoneTransaction = async (
    data: Record<string, unknown>,
  ): Promise<MilestoneTransaction> => {
    const wallet = await WalletService.newWallet(this.network);
    const payload = data.payload as ITransactionPayload;
    const outputs = payload.essence.outputs
      .filter((o) => VALID_OUTPUTS_TYPES.includes(o.type))
      .map((o) => <VALID_OUTPUT>o);

    const entries: MilestoneTransactionEntry[] = [];
    for (let i = 0; i < outputs.length; ++i) {
      if (!VALID_OUTPUTS_TYPES.includes(outputs[i].type)) {
        continue;
      }
      const output = <VALID_OUTPUT>outputs[i];
      const address = wallet.bechAddressFromOutput(output);
      const entry: MilestoneTransactionEntry = {
        amount: Number(output.amount),
        address,
        nativeTokens: output.nativeTokens || [],
        unlockConditions: output.unlockConditions,
        outputId: getTransactionPayloadHex(payload) + indexToString(i),
      };
      if (output.type === NFT_OUTPUT_TYPE) {
        entry.nftOutput = output;
      } else if (output.type === BASIC_OUTPUT_TYPE) {
        entry.output = output;
      }
      entries.push(entry);
    }

    const fromAddresses: string[] = [];
    const unlocks = payload.unlocks.filter((u) => u.type === SIGNATURE_UNLOCK_TYPE);
    for (const signatureUnlock of unlocks) {
      const senderPublicKey = (<ISignatureUnlock>signatureUnlock).signature.publicKey;
      const pubKeyBytes = Converter.hexToBytes(HexHelper.stripPrefix(senderPublicKey));
      const walletEd25519Address = new Ed25519Address(pubKeyBytes);
      const walletAddress = walletEd25519Address.toAddress();
      const senderBech32 = Bech32Helper.toBech32(
        ED25519_ADDRESS_TYPE,
        walletAddress,
        wallet.info.protocol.bech32Hrp,
      );
      fromAddresses.push(senderBech32);
    }

    const build5TransactionId = await getMilestoneTransactionId(data);

    const consumedOutputIds = payload.essence.inputs.map((input) =>
      TransactionHelper.outputIdFromTransactionData(
        input.transactionId,
        input.transactionOutputIndex,
      ),
    );

    return {
      uid: data.uid as string,
      createdOn: data.createdOn as Timestamp,
      messageId: data.blockId as string,
      milestone: data.milestone as number,
      consumedOutputIds,
      fromAddresses,
      outputs: entries,
      processed: data.processed as boolean,
      build5TransactionId: build5TransactionId || undefined,
    };
  };
}
