import { DEFAULT_PROTOCOL_VERSION, IBlock, ITransactionPayload, SingleNodeClient } from "@iota/iota.js-next";

export const submitBlocks = async (client: SingleNodeClient, payloads: ITransactionPayload[]): Promise<string[]> => {
  const blockIds: string[] = [];
  const parents = (await client.tips()).tips;

  for (let i = 0; i < payloads.length; ++i) {
    const block: IBlock = {
      protocolVersion: DEFAULT_PROTOCOL_VERSION,
      parents: i ? [blockIds[i - 1]] : parents,
      payload: payloads[i],
      nonce: "0"
    };
    const blockId = await client.blockSubmit(block)
    blockIds.push(blockId)
  }

  return blockIds;
}
