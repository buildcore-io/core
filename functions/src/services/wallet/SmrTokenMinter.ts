import * as lib from "@iota/iota.js-next";
import { ALIAS_OUTPUT_TYPE, FOUNDRY_OUTPUT_TYPE, IAliasOutput, IFoundryOutput, IndexerPluginClient, SingleNodeClient, TransactionHelper } from "@iota/iota.js-next";
import { Member, Network } from "../../../interfaces/models";
import { Token, TokenDrop } from "../../../interfaces/models/token";
import admin from "../../admin.config";
import { getAddress } from "../../utils/address.utils";
import { fetchAndWaitForBasicOutput, submitBlocks } from "../../utils/basic-output.utils";
import { waitForBlockToBecomeSolid } from "../../utils/block.utils";
import { createAlias, createAliasOutput, transferAlias } from "./token/alias.utils";
import { createBasicOutputsWithNativeTokens, getClaimableTokens, mintMoreTokens } from "./token/claim-minted.utils";
import { getTransactionPayloadHex } from "./token/common.utils";
import { createFoundryMintToken as createFoundryAndNextAlias, createFoundryOutput } from "./token/foundry.utils";
import { AddressDetails, getNodeClient, WalletService } from "./wallet";

export class SmrTokenMinter {
  private client: SingleNodeClient

  constructor(readonly network: Network) {
    this.client = getNodeClient(network) as SingleNodeClient
  }

  public mintToken = async (source: AddressDetails, targetBech32: string, token: Token) => {
    const info = await this.client.info()
    const networkId = lib.TransactionHelper.networkIdFromNetworkName(info.protocol.networkName)

    const aliasOutput = await createAlias(this.client, networkId, source);

    const targetAddress = lib.Bech32Helper.addressFromBech32(targetBech32, info.protocol.bech32HRP)
    const foundryAndNextAliasOutput = await createFoundryAndNextAlias(
      aliasOutput.essence.outputs[0],
      getTransactionPayloadHex(aliasOutput),
      source.keyPair,
      info.protocol.rentStructure,
      networkId,
      token
    );

    const transferAliasOutput = transferAlias(
      foundryAndNextAliasOutput.essence.outputs[0],
      getTransactionPayloadHex(foundryAndNextAliasOutput),
      source.keyPair,
      targetAddress,
      networkId
    );

    const payloads = [aliasOutput, foundryAndNextAliasOutput, transferAliasOutput]
    const blockIds = await submitBlocks(this.client, payloads)
    const blockAwaitPromises = blockIds.map(blockId => waitForBlockToBecomeSolid(this.client, blockId))
    await Promise.all(blockAwaitPromises)

    const aliasId = (foundryAndNextAliasOutput.essence.outputs.find(o => o.type === ALIAS_OUTPUT_TYPE) as IAliasOutput).aliasId
    const foundryOutput = (foundryAndNextAliasOutput.essence.outputs.find(o => o.type === FOUNDRY_OUTPUT_TYPE) as IFoundryOutput)
    const tokenId = TransactionHelper.constructTokenId(aliasId, foundryOutput.serialNumber, foundryOutput.tokenScheme.type);
    return { aliasId, tokenId, blockId: blockIds[1] }
  }

  public getStorageDepositForMinting = async (token: Token, targetHex: string) => {
    const info = await this.client.info()
    const aliasOutput = createAliasOutput(0, targetHex)
    const foundryOutput = createFoundryOutput(token.totalSupply, aliasOutput, JSON.stringify({ uid: token.uid, symbol: token.symbol }))
    const aliasStorageDep = TransactionHelper.getStorageDeposit(aliasOutput, info.protocol.rentStructure)
    const foundryStorageDep = TransactionHelper.getStorageDeposit(foundryOutput, info.protocol.rentStructure)
    return aliasStorageDep + foundryStorageDep
  }

  public claimMintedToken = async (member: Member, token: Token, source: AddressDetails, drops: TokenDrop[]) => {
    const consumedOutputId = await fetchAndWaitForBasicOutput(this.client, source.bech32);
    const consumedOutput = (await this.client.output(consumedOutputId)).output;
    const aliasOutputId = await this.getAliasOutputId(token.mintingData?.aliasId!)
    const aliasOutput = (await this.client.output(aliasOutputId)).output as IAliasOutput
    const foundryOutputId = await this.getFoundryOutputId(token.mintingData?.tokenId!)
    const foundryOutput = (await this.client.output(foundryOutputId)).output as IFoundryOutput

    const info = await this.client.info()
    const payload = await mintMoreTokens(
      info,
      WalletService.newWallet(token.mintingData?.network!),
      consumedOutput,
      consumedOutputId,
      aliasOutput,
      aliasOutputId,
      foundryOutput,
      foundryOutputId,
      drops,
      source,
      getAddress(member.validatedAddress, token.mintingData?.network!)
    )
    const blockId = (await submitBlocks(this.client, [payload]))[0];
    await waitForBlockToBecomeSolid(this.client, blockId)
    return blockId
  }

  public getStorageDepositForClaimingToken = async (transaction: admin.firestore.Transaction, member: Member, token: Token) => {
    const drops = await getClaimableTokens(transaction, member.uid, token)
    const outputs = await createBasicOutputsWithNativeTokens(
      getAddress(member.validatedAddress, token.mintingData?.network!),
      token.mintingData?.tokenId!,
      await this.client.info(),
      drops
    )
    return outputs.reduce((acc, act) => acc + Number(act.amount), 0)
  }

  private getAliasOutputId = async (aliasId: string) => {
    const indexerPlugin = new IndexerPluginClient(this.client);
    const alias = await indexerPlugin.alias(aliasId)
    return alias.items[0];
  }

  private getFoundryOutputId = async (foundryId: string) => {
    const indexerPlugin = new IndexerPluginClient(this.client);
    const foundry = await indexerPlugin.foundry(foundryId)
    return foundry.items[0];
  }

}
