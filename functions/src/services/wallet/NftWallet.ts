import {
  AddressTypes,
  ADDRESS_UNLOCK_CONDITION_TYPE, Bech32Helper, DEFAULT_PROTOCOL_VERSION, ED25519_ADDRESS_TYPE, IBasicOutput, IBlock, IndexerPluginClient,
  INftAddress, INftOutput, NFT_ADDRESS_TYPE, REFERENCE_UNLOCK_TYPE, TransactionHelper, UnlockTypes
} from "@iota/iota.js-next";
import { cloneDeep, isEmpty } from "lodash";
import { Collection, Transaction } from "../../../interfaces/models";
import { COL } from "../../../interfaces/models/base";
import { Nft } from "../../../interfaces/models/nft";
import admin from "../../admin.config";
import { packBasicOutput } from "../../utils/basic-output.utils";
import { packEssence, packPayload, submitBlock } from "../../utils/block.utils";
import { collectionToMetadata, createNftOutput, EMPTY_NFT_ID, nftToMetadata } from "../../utils/collection-minting-utils/nft.utils";
import { createUnlock } from "../../utils/smr.utils";
import { MnemonicService } from "./mnemonic";
import { SmrParams, SmrWallet } from "./SmrWalletService";
import { AddressDetails, setConsumedOutputIds } from "./wallet";

export interface MintNftInputParams {
  readonly collectionOutputId: string;
  readonly collectionOutput: INftOutput;
  readonly consumedOutputId: string;
  readonly consumedOutput: IBasicOutput;
}

export class NftWallet {

  constructor(private readonly wallet: SmrWallet) { }

  public mintCollection = async (transaction: Transaction, params: SmrParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress)
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32)

    const outputsMap = await this.wallet.getOutputs(sourceAddress.bech32, sourceMnemonic.consumedOutputIds)
    const totalAmount = Object.values(outputsMap).reduce((acc, act) => acc + Number(act.amount), 0)

    const collection = <Collection>(await admin.firestore().doc(`${COL.COLLECTION}/${transaction.payload.collection}`).get()).data()
    const ownerAddress: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: sourceAddress.hex }
    const collectionOutput = createNftOutput(ownerAddress, ownerAddress, JSON.stringify(collectionToMetadata(collection)), this.wallet.info)

    const remainderAmount = totalAmount - Number(collectionOutput.amount)
    const remainder = packBasicOutput(sourceAddress.bech32, remainderAmount, [], this.wallet.info)

    const inputs = Object.keys(outputsMap).map(TransactionHelper.inputFromOutputId)
    const inputsCommitment = TransactionHelper.getInputsCommitment(Object.values(outputsMap));
    const outputs = remainderAmount ? [collectionOutput, remainder] : [collectionOutput]
    const essence = packEssence(inputs, inputsCommitment, outputs, this.wallet, params)

    await setConsumedOutputIds(sourceAddress.bech32, Object.keys(outputsMap))
    return await submitBlock(this.wallet, packPayload(essence, [createUnlock(essence, sourceAddress.keyPair)]));
  }

  public mintNfts = async (transaction: Transaction, params: SmrParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress)
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32)

    const outputsMap = await this.wallet.getOutputs(sourceAddress.bech32, sourceMnemonic.consumedOutputIds)
    const [consumedOutputId, consumedOutput] = Object.entries(outputsMap)[0]

    const collectionOutputs = await this.getNftOutputs(undefined, sourceAddress.bech32, sourceMnemonic.consumedNftOutputIds)
    const [collectionOutputId, collectionOutput] = Object.entries(collectionOutputs)[0]
    const collectionNftId = TransactionHelper.resolveIdFromOutputId(collectionOutputId)

    const nftOutputPromises = (transaction.payload.nfts as string[]).map(async (nftId) => {
      const nft = <Nft>(await admin.firestore().doc(`${COL.NFT}/${nftId}`).get()).data()
      const address = nft.mintingData?.address ? await this.wallet.getAddressDetails(nft.mintingData?.address) : (await this.wallet.getNewIotaAddressDetails())
      const output = this.packNft(nft, address, collectionNftId)
      await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).update({
        'mintingData.address': address.bech32,
        'mintingData.storageDeposit': Number(output.amount)
      })
      return output
    })
    const nftOutputs = await Promise.all(nftOutputPromises)
    const nftTotalStorageDeposit = nftOutputs.reduce((acc, act) => acc + Number(act.amount), 0)

    const remainderAmount = Number(consumedOutput.amount) - nftTotalStorageDeposit
    const remainder = packBasicOutput(sourceAddress.bech32, remainderAmount, [], this.wallet.info);

    const parents = (await this.wallet.client.tips()).tips
    const inputs: MintNftInputParams = { collectionOutputId, collectionOutput, consumedOutputId, consumedOutput }
    const block = this.packNftMintBlock(sourceAddress, parents, inputs, nftOutputs, remainderAmount ? remainder : undefined, params)

    await setConsumedOutputIds(sourceAddress.bech32, [consumedOutputId], [collectionOutputId], [])
    return await this.wallet.client.blockSubmit(block)
  }

  public packNftMintBlock = (
    address: AddressDetails,
    parents: string[],
    input: MintNftInputParams,
    nftOutputs: INftOutput[],
    reminder: IBasicOutput | undefined,
    params: SmrParams
  ) => {
    const inputs = [input.collectionOutputId, input.consumedOutputId].map(TransactionHelper.inputFromOutputId)
    const inputsCommitment = TransactionHelper.getInputsCommitment([input.collectionOutput, input.consumedOutput!]);
    const outputs = [input.collectionOutput, ...nftOutputs]
    const essence = packEssence(inputs, inputsCommitment, reminder ? [...outputs, reminder] : outputs, this.wallet, params)
    const unlocks: UnlockTypes[] = [createUnlock(essence, address.keyPair), { type: REFERENCE_UNLOCK_TYPE, reference: 0 }]
    return <IBlock>{ protocolVersion: DEFAULT_PROTOCOL_VERSION, parents, payload: packPayload(essence, unlocks), nonce: "0" }
  }

  public packNft = (nft: Nft, address: AddressDetails, collectionNftId: string) => {
    const issuerAddress: INftAddress = { type: NFT_ADDRESS_TYPE, nftId: collectionNftId }
    const ownerAddress: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: address.hex }
    return createNftOutput(ownerAddress, issuerAddress, JSON.stringify(nftToMetadata(nft)), this.wallet.info)
  }

  public changeNftOwner = async (transaction: Transaction, params: SmrParams) => {
    const sourceMnemonic = await MnemonicService.getData(transaction.payload.sourceAddress)
    const nftOutputs = await this.getNftOutputs(transaction.payload.nftId, transaction.payload.sourceAddress, sourceMnemonic.consumedNftOutputIds)

    const nftOutput = Object.values(nftOutputs)[0]

    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress)
    const targetAddress = Bech32Helper.addressFromBech32(transaction.payload.targetAddress, this.wallet.info.protocol.bech32Hrp)
    const output = cloneDeep(nftOutput)
    output.unlockConditions = [{ type: ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress }]

    if (output.nftId === EMPTY_NFT_ID) {
      output.nftId = TransactionHelper.resolveIdFromOutputId(Object.keys(nftOutputs)[0])
    }

    const inputs = Object.keys(nftOutputs).map(TransactionHelper.inputFromOutputId)
    const inputsCommitment = TransactionHelper.getInputsCommitment(Object.values(nftOutputs));
    const essence = packEssence(inputs, inputsCommitment, [output], this.wallet, params)

    await setConsumedOutputIds(sourceAddress.bech32, [], Object.keys(nftOutputs))
    return await submitBlock(this.wallet, packPayload(essence, [createUnlock(essence, sourceAddress.keyPair)]))
  }

  public getNftOutputs = async (nftId: string | undefined, sourceAddress: string | undefined, prevConsumedNftOutputId: string[] = []) => {
    const outputIds = await this.getNftOutputIds(nftId, sourceAddress, prevConsumedNftOutputId)
    const outputs: { [key: string]: INftOutput } = {}
    for (const id of outputIds) {
      const output = (await this.wallet.client.output(id)).output
      outputs[id] = output as INftOutput
    }
    return outputs
  }

  private getNftOutputIds = async (nftId: string | undefined, sourceAddress: string | undefined, prevConsumedNftOutputId: string[] = []) => {
    const indexer = new IndexerPluginClient(this.wallet.client)
    if (!isEmpty(prevConsumedNftOutputId)) {
      return prevConsumedNftOutputId
    }
    if (nftId) {
      return (await indexer.nft(nftId)).items
    }
    const items = (await indexer.nfts({ addressBech32: sourceAddress })).items
    return isEmpty(items) ? [] : [items[0]]
  }

}