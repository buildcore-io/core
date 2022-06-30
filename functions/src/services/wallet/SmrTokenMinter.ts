import * as lib from "@iota/iota.js-next";
import { Token } from "../../../interfaces/models/token";
import { createAlias, transferAlias } from "./token/alias.utils";
import { chainTransactionsViaBlocks, getTransactionPayloadHex } from "./token/common.utils";
import { createFoundryMintToken } from "./token/foundry.utils";
import { AddressDetails } from "./wallet";

export class SmrTokenMinter {
  constructor(private readonly client: lib.SingleNodeClient, private readonly info: lib.INodeInfo) { }

  public getTotalStorageDeposit = async (source: AddressDetails, target: AddressDetails, token: Token) => {
    const { totalStorageDeposit } = await this.createTokenMintPayloads(source, target, token)
    return totalStorageDeposit
  }

  public mintToken = async (source: AddressDetails, target: AddressDetails, token: Token): Promise<void> => {
    const { payloads } = await this.createTokenMintPayloads(source, target, token)
    const blocks = await chainTransactionsViaBlocks(this.client, payloads, this.info.protocol.minPoWScore);
    for (const block of blocks) {
      await this.client.blockSubmit(block)
    }
  }

  private createTokenMintPayloads = async (source: AddressDetails, target: AddressDetails, token: Token) => {
    const networkId = lib.TransactionHelper.networkIdFromNetworkName(this.info.protocol.networkName)
    const aliasOutput = await createAlias(this.client, networkId, source);

    const targetAddress = lib.Bech32Helper.addressFromBech32(target.bech32, this.info.protocol.bech32HRP)
    const { totalStorageDeposit, payload: foundryOutput } = await createFoundryMintToken(
      aliasOutput.essence.outputs[0],
      getTransactionPayloadHex(aliasOutput),
      source.keyPair,
      targetAddress,
      this.info.protocol.rentStructure,
      networkId,
      token
    );

    const transferAliasOutput = transferAlias(
      foundryOutput.essence.outputs[0],
      getTransactionPayloadHex(foundryOutput),
      source.keyPair,
      targetAddress,
      networkId
    );
    const payloads = [aliasOutput, foundryOutput, transferAliasOutput]

    return { payloads, totalStorageDeposit }
  }

}
