import { SingleNodeClient } from "@iota/iota.js-next";

export const waitForBlockToBecomeSolid = async (client: SingleNodeClient, blockId: string) => {
  for (let i = 0; i < 150; ++i) {
    const blockMetadata = await client.blockMetadata(blockId)
    if (blockMetadata.isSolid) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Block is not solid')
}