import { DEFAULT_PROTOCOL_VERSION, IBlock, ITransactionPayload, SingleNodeClient } from "@iota/iota.js-next";

export const waitForBlockToBeIncluded = async (client: SingleNodeClient, blockId: string) => {
  for (let i = 0; i < 120; ++i) {
    const metadata = await client.blockMetadata(blockId)
    if (!metadata.ledgerInclusionState) {
      await new Promise(resolve => setTimeout(resolve, 500));
      continue
    }
    if (metadata.ledgerInclusionState === 'included') {
      return
    }
    throw new Error('Block inclusion error: ' + blockId)
  }
  throw new Error('Block was not included: ' + blockId)
}

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
