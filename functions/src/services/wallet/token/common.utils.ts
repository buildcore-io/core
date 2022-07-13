
import { Ed25519 } from "@iota/crypto.js-next";
import { DEFAULT_PROTOCOL_VERSION, ED25519_SIGNATURE_TYPE, IBlock, IKeyPair, IndexerPluginClient, ISignatureUnlock, ITransactionEssence, ITransactionPayload, IUTXOInput, MAX_BLOCK_LENGTH, OutputTypes, serializeBlock, SIGNATURE_UNLOCK_TYPE, SingleNodeClient, TransactionHelper, TRANSACTION_ESSENCE_TYPE, TRANSACTION_PAYLOAD_TYPE } from "@iota/iota.js-next";
import { WasmPowProvider } from "@iota/pow-wasm.js";
import { Converter, WriteStream } from "@iota/util.js-next";

export const createUnlock = (essence: ITransactionEssence, keyPair: IKeyPair): ISignatureUnlock => {
  const essenceHash = TransactionHelper.getTransactionEssenceHash(essence)
  return {
    type: SIGNATURE_UNLOCK_TYPE,
    signature: {
      type: ED25519_SIGNATURE_TYPE,
      publicKey: Converter.bytesToHex(keyPair.publicKey, true),
      signature: Converter.bytesToHex(Ed25519.sign(keyPair.privateKey, essenceHash), true)
    }
  };
}

export const createPayload = (
  networkId: string,
  inputs: IUTXOInput[],
  outputs: OutputTypes[],
  commitment: string,
  keyPair: IKeyPair
): ITransactionPayload => {
  const essence: ITransactionEssence = { type: TRANSACTION_ESSENCE_TYPE, networkId, inputs, outputs, inputsCommitment: commitment };
  return { type: TRANSACTION_PAYLOAD_TYPE, essence, unlocks: [createUnlock(essence, keyPair)] };
}

export const getTransactionPayloadHex = (payload: ITransactionPayload) =>
  Converter.bytesToHex(TransactionHelper.getTransactionPayloadHash(payload), true) + "0000";

export const chainTransactionsViaBlocks = async (client: SingleNodeClient, txs: Array<ITransactionPayload>, minPoWScore: number): Promise<Array<IBlock>> => {
  const blockIds: Array<string> = [];
  const blocks: Array<IBlock> = [];

  const parents = (await client.tips()).tips;

  for (let i = 0; i < txs.length; i++) {
    const block: IBlock = {
      protocolVersion: DEFAULT_PROTOCOL_VERSION,
      parents: [],
      payload: txs[i],
      nonce: "0"
    };

    if (i === 0) {
      block.parents = parents;
    } else {
      block.parents = [blockIds[i - 1]];
    }

    const blockNonce = await caluclateNonce(block, minPoWScore);
    block.nonce = blockNonce;
    const blockId = TransactionHelper.calculateBlockId(block);
    blockIds.push(blockId);
    blocks.push(block);
  }

  return blocks;
}

const caluclateNonce = async (block: IBlock, minPoWScore: number): Promise<string> => {
  const writeStream = new WriteStream();
  serializeBlock(writeStream, block);
  const blockBytes = writeStream.finalBytes();

  if (blockBytes.length > MAX_BLOCK_LENGTH) {
    throw new Error(
      `The block length is ${blockBytes.length}, which exceeds the maximum size of ${MAX_BLOCK_LENGTH}`
    );
  }

  const powProvider = new WasmPowProvider();
  const nonce = await powProvider.pow(blockBytes, minPoWScore);
  return nonce.toString();
}


export const fetchAndWaitForBasicOutput = async (client: SingleNodeClient, addressBech32: string,): Promise<string> => {
  const indexerPluginClient = new IndexerPluginClient(client!);
  for (let i = 0; i < 10; ++i) {
    const outputsResponse = await indexerPluginClient.outputs({
      addressBech32,
      hasStorageReturnCondition: false,
      hasExpirationCondition: false,
      hasTimelockCondition: false,
      hasNativeTokens: false
    });
    if (outputsResponse.items.length) {
      return outputsResponse.items[0]
    }
    await new Promise(f => setTimeout(f, 5000));
  }
  throw new Error("Didn't find any outputs for address: " + addressBech32);
};
