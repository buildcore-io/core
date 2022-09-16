import {
  ADDRESS_UNLOCK_CONDITION_TYPE, Bech32Helper, IndexerPluginClient,
  INftAddress, INftOutput, ITransactionEssence, ITransactionPayload, NFT_ADDRESS_TYPE, REFERENCE_UNLOCK_TYPE, TAGGED_DATA_PAYLOAD_TYPE,
  TransactionHelper, TRANSACTION_ESSENCE_TYPE, TRANSACTION_PAYLOAD_TYPE
} from "@iota/iota.js-next";
import { Converter } from '@iota/util.js-next';
import { cloneDeep, isEmpty } from "lodash";
import { KEY_NAME_TANGLE } from "../../../interfaces/config";
import { Collection, Transaction } from "../../../interfaces/models";
import { COL } from "../../../interfaces/models/base";
import { Nft } from "../../../interfaces/models/nft";
import admin from "../../admin.config";
import { packBasicOutput } from "../../utils/basic-output.utils";
import { submitBlocks } from "../../utils/block.utils";
import { collectionToMetadata, createNftOutput, EMPTY_NFT_ID, nftToMetadata } from "../../utils/collection-minting-utils/nft.utils";
import { createUnlock } from "../../utils/smr.utils";
import { MnemonicService } from "./mnemonic";
import { SmrParams, SmrWallet } from "./SmrWalletService";
import { AddressDetails, setConsumedOutputIds } from "./wallet";


export class NftWallet {

  constructor(private readonly wallet: SmrWallet) { }

  public mintCollection = async (issuerAddress: AddressDetails, collectionId: string, params?: SmrParams) => {
    await this.wallet.init()
    const previouslyConsumedOutputIds = (await MnemonicService.getData(issuerAddress.bech32)).consumedOutputIds || []
    const outputsMap = await this.wallet.getOutputs(issuerAddress.bech32, previouslyConsumedOutputIds)
    const totalAmount = Object.values(outputsMap).reduce((acc, act) => acc + Number(act.amount), 0)

    const collection = <Collection>(await admin.firestore().doc(`${COL.COLLECTION}/${collectionId}`).get()).data()
    const collectionOutput = createNftOutput(issuerAddress, undefined, JSON.stringify(collectionToMetadata(collection)), this.wallet.nodeInfo!)
    await admin.firestore().doc(`${COL.COLLECTION}/${collection.uid}`).update({ 'mintingData.storageDeposit': Number(collectionOutput.amount) })
    const remainderAmount = totalAmount - Number(collectionOutput.amount)
    const remainder = packBasicOutput(issuerAddress.bech32, remainderAmount, [], this.wallet.nodeInfo!)

    const inputs = Object.keys(outputsMap).map(TransactionHelper.inputFromOutputId)
    const inputsCommitment = TransactionHelper.getInputsCommitment(Object.values(outputsMap));
    const essence: ITransactionEssence = {
      type: TRANSACTION_ESSENCE_TYPE,
      networkId: TransactionHelper.networkIdFromNetworkName(this.wallet.nodeInfo!.protocol.networkName),
      inputs,
      outputs: remainderAmount ? [collectionOutput, remainder] : [collectionOutput],
      inputsCommitment,
      payload: {
        type: TAGGED_DATA_PAYLOAD_TYPE,
        tag: Converter.utf8ToHex(KEY_NAME_TANGLE, true),
        data: Converter.utf8ToHex(params?.data || '', true)
      }
    };
    const payload: ITransactionPayload = { type: TRANSACTION_PAYLOAD_TYPE, essence, unlocks: [createUnlock(essence, issuerAddress.keyPair)] };
    await setConsumedOutputIds(issuerAddress.bech32, Object.keys(outputsMap))
    return (await submitBlocks(this.wallet.client, [payload]))[0];
  }

  public mintNfts = async (transaction: Transaction, params?: SmrParams) => {
    await this.wallet.init()
    const issuerAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress)

    const sourceMnemonic = await MnemonicService.getData(issuerAddress.bech32)
    const outputsMap = await this.wallet.getOutputs(issuerAddress.bech32, sourceMnemonic.consumedOutputIds)
    const totalAmount = Object.values(outputsMap).reduce((acc, act) => acc + Number(act.amount), 0)

    const collectionOutputs = await this.getNftOutputs(undefined, transaction.payload.sourceAddress, sourceMnemonic.consumedNftOutputIds)
    const nftOutputPromises = (transaction.payload.nfts as string[]).map(async (nftId) => {
      const nft = <Nft>(await admin.firestore().doc(`${COL.NFT}/${nftId}`).get()).data()
      const address = nft.mintingData?.address ? await this.wallet.getAddressDetails(nft.mintingData?.address) : (await this.wallet.getNewIotaAddressDetails())
      const collectionNftAddress: INftAddress = { type: NFT_ADDRESS_TYPE, nftId: TransactionHelper.resolveIdFromOutputId(Object.keys(collectionOutputs)[0]) }
      const output = createNftOutput(address, collectionNftAddress, JSON.stringify(nftToMetadata(nft)), this.wallet.nodeInfo!)
      await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).update({
        'mintingData.address': address.bech32,
        'mintingData.network': transaction.network!,
        'mintingData.storageDeposit': Number(output.amount),
        'mintingData.mintingOrderId': transaction.uid
      })
      return output
    })
    const nftOutputs = await Promise.all(nftOutputPromises)
    const nftTotalStorageDeposit = nftOutputs.reduce((acc, act) => acc + Number(act.amount), 0)

    const remainderAmount = totalAmount - nftTotalStorageDeposit
    const remainder = packBasicOutput(issuerAddress.bech32, remainderAmount, [], this.wallet.nodeInfo!)

    const inputs = [...Object.keys(collectionOutputs), ...Object.keys(outputsMap)].map(TransactionHelper.inputFromOutputId)
    const inputsCommitment = TransactionHelper.getInputsCommitment([...Object.values(collectionOutputs), ...Object.values(outputsMap)]);
    const outputs = [...Object.values(collectionOutputs), ...nftOutputs]
    const essence: ITransactionEssence = {
      type: TRANSACTION_ESSENCE_TYPE,
      networkId: TransactionHelper.networkIdFromNetworkName(this.wallet.nodeInfo!.protocol.networkName),
      inputs,
      outputs: remainderAmount ? [...outputs, remainder] : outputs,
      inputsCommitment,
      payload: {
        type: TAGGED_DATA_PAYLOAD_TYPE,
        tag: Converter.utf8ToHex(KEY_NAME_TANGLE, true),
        data: Converter.utf8ToHex(params?.data || '', true)
      }
    };

    const payload: ITransactionPayload = { type: TRANSACTION_PAYLOAD_TYPE, essence, unlocks: [createUnlock(essence, issuerAddress.keyPair), { type: REFERENCE_UNLOCK_TYPE, reference: 0 }] };
    await setConsumedOutputIds(issuerAddress.bech32, Object.keys(outputsMap), Object.keys(collectionOutputs))

    return (await submitBlocks(this.wallet.client, [payload]))[0];
  }

  public changeNftOwner = async (transaction: Transaction, params?: SmrParams) => {
    await this.wallet.init()

    const sourceMnemonic = await MnemonicService.getData(transaction.payload.sourceAddress)
    const nftOutputs = await this.getNftOutputs(transaction.payload.nftId, transaction.payload.sourceAddress, sourceMnemonic.consumedNftOutputIds)

    const nftOutput = Object.values(nftOutputs)[0]

    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress)
    const targetAddress = Bech32Helper.addressFromBech32(transaction.payload.targetAddress, this.wallet.nodeInfo!.protocol.bech32Hrp)
    const output = cloneDeep(nftOutput)
    output.unlockConditions = [{ type: ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress }]

    if (output.nftId === EMPTY_NFT_ID) {
      output.nftId = TransactionHelper.resolveIdFromOutputId(Object.keys(nftOutputs)[0])
    }

    const inputs = Object.keys(nftOutputs).map(TransactionHelper.inputFromOutputId)
    const inputsCommitment = TransactionHelper.getInputsCommitment(Object.values(nftOutputs));
    const essence: ITransactionEssence = {
      type: TRANSACTION_ESSENCE_TYPE,
      networkId: TransactionHelper.networkIdFromNetworkName(this.wallet.nodeInfo!.protocol.networkName),
      inputs,
      outputs: [output],
      inputsCommitment,
      payload: {
        type: TAGGED_DATA_PAYLOAD_TYPE,
        tag: Converter.utf8ToHex(KEY_NAME_TANGLE, true),
        data: Converter.utf8ToHex(params?.data || '', true)
      }
    };

    const payload: ITransactionPayload = { type: TRANSACTION_PAYLOAD_TYPE, essence, unlocks: [createUnlock(essence, sourceAddress.keyPair)] };
    await setConsumedOutputIds(sourceAddress.bech32, [], Object.keys(nftOutputs))

    return (await submitBlocks(this.wallet.client, [payload]))[0];
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