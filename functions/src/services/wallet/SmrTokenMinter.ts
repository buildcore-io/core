import * as lib from "@iota/iota.js-next";
import { IAliasOutput, IFoundryOutput, IndexerPluginClient, SingleNodeClient, TransactionHelper } from "@iota/iota.js-next";
import { Member } from "../../../interfaces/models";
import { Token } from "../../../interfaces/models/token";
import admin from "../../admin.config";
import { getAddress } from "../../utils/address.utils";
import { createAlias, createAliasOutput, transferAlias } from "./token/alias.utils";
import { getStorageDepositForClaimingToken, mintMoreTokens } from "./token/claim-minted.utils";
import { chainTransactionsViaBlocks, fetchAndWaitForBasicOutput, getTransactionPayloadHex } from "./token/common.utils";
import { createFoundryMintToken, createFoundryOutput } from "./token/foundry.utils";
import { AddressDetails, WalletService } from "./wallet";

export class SmrTokenMinter {

  constructor(readonly client: SingleNodeClient) { }

  public mintToken = async (source: AddressDetails, target: AddressDetails, token: Token) => {
    const info = await this.client.info()
    const networkId = lib.TransactionHelper.networkIdFromNetworkName(info.protocol.networkName)

    const aliasOutput = await createAlias(this.client, networkId, source);

    const targetAddress = lib.Bech32Helper.addressFromBech32(target.bech32, info.protocol.bech32HRP)
    const foundryOutput = await createFoundryMintToken(
      aliasOutput.essence.outputs[0],
      getTransactionPayloadHex(aliasOutput),
      source.keyPair,
      targetAddress,
      info.protocol.rentStructure,
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
    const blocks = await chainTransactionsViaBlocks(this.client, payloads, (await this.client.info()).protocol.minPoWScore);
    for (const block of blocks) {
      await this.client.blockSubmit(block)
    }
  }

  public getStorageDepositForMinting = async (target: AddressDetails, token: Token) => {
    const info = await this.client.info()
    const aliasOutput = createAliasOutput(0, target.hex)
    const foundryOutput = createFoundryOutput(token.totalSupply, aliasOutput, JSON.stringify({ uid: token.uid, symbol: token.symbol }))
    const aliasStorageDep = TransactionHelper.getStorageDeposit(aliasOutput, info.protocol.rentStructure)
    const foundryStorageDep = TransactionHelper.getStorageDeposit(foundryOutput, info.protocol.rentStructure)
    return aliasStorageDep + foundryStorageDep
  }

  public claimMintedToken = async (transaction: admin.firestore.Transaction, member: Member, token: Token, source: AddressDetails, toMint: number) => {
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
      toMint,
      source,
      getAddress(member.validatedAddress, token.mintingData?.network!)
    )
    const blocks = await chainTransactionsViaBlocks(this.client, [payload], info.protocol.minPoWScore);
    for (const block of blocks) {
      await this.client.blockSubmit(block)
    }
    return payload
  }

  public getStorageDepositForClaimingToken = async (transaction: admin.firestore.Transaction, member: Member, token: Token) =>
    getStorageDepositForClaimingToken(transaction, member, token, await this.client.info())

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
