import { Bip32Path } from "@iota/crypto.js-next";
import {
  addressBalance, ADDRESS_UNLOCK_CONDITION_TYPE, BASIC_OUTPUT_TYPE,
  Bech32Helper,
  Ed25519Address,
  Ed25519Seed,
  ED25519_ADDRESS_TYPE, IAliasOutput,
  IBasicOutput, IFoundryOutput, IndexerPluginClient,
  INftAddress,
  INftOutput,
  INodeInfo, ITransactionEssence, ITransactionPayload, NFT_ADDRESS_TYPE, REFERENCE_UNLOCK_TYPE, SingleNodeClient,
  TAGGED_DATA_PAYLOAD_TYPE,
  TransactionHelper, TRANSACTION_ESSENCE_TYPE, TRANSACTION_PAYLOAD_TYPE, UnlockTypes
} from "@iota/iota.js-next";
import { Converter } from '@iota/util.js-next';
import { generateMnemonic } from 'bip39';
import { cloneDeep, isEmpty } from "lodash";
import { KEY_NAME_TANGLE } from "../../../interfaces/config";
import { Collection, Network, Transaction } from "../../../interfaces/models";
import { COL, Timestamp } from "../../../interfaces/models/base";
import { NativeToken } from "../../../interfaces/models/milestone";
import { Nft } from "../../../interfaces/models/nft";
import admin from "../../admin.config";
import { mergeOutputs, packBasicOutput, subtractHex } from "../../utils/basic-output.utils";
import { Bech32AddressHelper } from "../../utils/bech32-address.helper";
import { submitBlocks } from "../../utils/block.utils";
import { collectionToMetadata, createNftOutput, EMPTY_NFT_ID, nftToMetadata } from "../../utils/collection-minting-utils/nft.utils";
import { getRandomElement } from "../../utils/common.utils";
import { createUnlock } from "../../utils/smr.utils";
import { MnemonicService } from "./mnemonic";
import { AddressDetails, setConsumedOutputIds, Wallet, WalletParams } from "./wallet";

const RMS_API_ENDPOINTS = ['https://sd1.svrs.io/', 'https://sd2.svrs.io/', 'https://sd3.svrs.io/']
const SMR_API_ENDPOINTS = RMS_API_ENDPOINTS

export const getEndpointUrl = (network: Network) => {
  const urls = network === Network.SMR ? SMR_API_ENDPOINTS : RMS_API_ENDPOINTS
  return getRandomElement(urls)
}

export interface SmrParams extends WalletParams {
  readonly storageDepositSourceAddress?: string;
  readonly nativeTokens?: NativeToken[];
  readonly storageDepositReturnAddress?: string;
  readonly vestingAt?: Timestamp;
}

export const getShimmerClient = async (network: Network) => {
  for (let i = 0; i < 5; ++i) {
    try {
      const client = new SingleNodeClient(getEndpointUrl(network))
      const healty = await client.health()
      if (healty) {
        return client
      }
    } catch {
      // None.
    }
  }
  throw Error('Could not connect to any client ' + network)
}

export class SmrWallet implements Wallet<SmrParams> {
  private nodeInfo?: INodeInfo;

  constructor(public readonly client: SingleNodeClient, private readonly network: Network) {
  }

  private init = async () => {
    if (!this.nodeInfo) {
      this.nodeInfo = await this.client.info();
    }
  }

  public getBalance = async (addressBech32: string) => {
    const balance = await addressBalance(this.client, addressBech32)
    return Number(balance.balance)
  }

  public getNewIotaAddressDetails = async () => {
    const address = await this.getIotaAddressDetails(generateMnemonic() + ' ' + generateMnemonic());
    await MnemonicService.store(address.bech32, address.mnemonic, this.network);
    return address;
  }

  public getIotaAddressDetails = async (mnemonic: string): Promise<AddressDetails> => {
    await this.init();

    const walletSeed = Ed25519Seed.fromMnemonic(mnemonic)
    const walletPath = new Bip32Path("m/44'/4218'/0'/0'/0'");
    const walletAddressSeed = walletSeed.generateSeedFromPath(walletPath);
    const keyPair = walletAddressSeed.keyPair();
    const walletEd25519Address = new Ed25519Address(keyPair.publicKey);
    const walletAddress = walletEd25519Address.toAddress();
    const hex = Converter.bytesToHex(walletAddress, true);
    const bech32 = Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, walletAddress, this.nodeInfo!.protocol.bech32Hrp)

    return { mnemonic, keyPair, hex, bech32 };
  }

  public getAddressDetails = async (bech32: string) => {
    const mnemonic = await MnemonicService.get(bech32)
    return this.getIotaAddressDetails(mnemonic)
  }

  public getTransactionOutput = async (transactionId: string, outputIndex: number) => {
    const outputId = TransactionHelper.outputIdFromTransactionData(transactionId, outputIndex)
    return await this.client.output(outputId)
  }

  public bechAddressFromOutput = async (output: IBasicOutput | IAliasOutput | IFoundryOutput | INftOutput) => {
    await this.init()
    const hrp = this.nodeInfo?.protocol.bech32Hrp!
    return Bech32AddressHelper.addressFromAddressUnlockCondition(output.unlockConditions, hrp, output.type);
  }

  public getOutputs = async (addressBech32: string, previouslyConsumedOutputIds: string[] = [], hasStorageDepositReturn = false) => {
    const indexer = new IndexerPluginClient(this.client)
    const query = {
      addressBech32,
      hasStorageDepositReturn,
      hasExpiration: false,
      hasTimelock: false,
    }
    const outputIds = isEmpty(previouslyConsumedOutputIds) ? (await indexer.basicOutputs(query)).items : previouslyConsumedOutputIds
    const outputs: { [key: string]: IBasicOutput } = {}
    for (const id of outputIds) {
      const output = (await this.client.output(id)).output
      if (output.type === BASIC_OUTPUT_TYPE) {
        outputs[id] = output
      }
    }
    return outputs
  }

  public getNftOutputIds = async (addressBech32: string, prevConsumedNftOutputId: string[] = []) => {
    const indexer = new IndexerPluginClient(this.client)
    const outputIds = isEmpty(prevConsumedNftOutputId) ? (await indexer.nfts({ addressBech32 })).items : prevConsumedNftOutputId
    const outputs: { [key: string]: INftOutput } = {}
    for (const id of outputIds) {
      const output = (await this.client.output(id)).output
      outputs[id] = output as INftOutput
    }
    return outputs
  }

  public send = async (from: AddressDetails, toBech32: string, amount: number, params?: SmrParams) => {
    await this.init()
    const prevConsumedOutputIds = (await MnemonicService.getData(from.bech32)).consumedOutputIds || []
    const outputsMap = await this.getOutputs(from.bech32, prevConsumedOutputIds)
    const output = packBasicOutput(toBech32, amount, params?.nativeTokens, this.nodeInfo!, params?.storageDepositReturnAddress, params?.vestingAt)

    const remainders: IBasicOutput[] = []

    let storageDepositOutputMap: { [key: string]: IBasicOutput } = {}
    if (params?.storageDepositSourceAddress) {
      const previouslyConsumedOutputIds = (await MnemonicService.getData(params?.storageDepositSourceAddress)).consumedOutputIds || []
      storageDepositOutputMap = await this.getOutputs(params.storageDepositSourceAddress, previouslyConsumedOutputIds)
      const remainder = mergeOutputs(cloneDeep(Object.values(storageDepositOutputMap)))
      remainder.amount = (Number(remainder.amount) - Number(output.amount)).toString()
      if (Number(remainder.amount)) {
        remainders.push(remainder)
      }
    }
    const remainder = mergeOutputs(cloneDeep(Object.values(outputsMap)))
    remainder.nativeTokens = subtractNativeTokens(remainder, params?.nativeTokens)
    if (!params?.storageDepositSourceAddress) {
      remainder.amount = (Number(remainder.amount) - Number(output.amount)).toString()
    }
    if (!isEmpty(remainder.nativeTokens) || Number(remainder.amount)) {
      remainders.push(remainder)
    }

    const inputs = [...Object.keys(outputsMap), ...Object.keys(storageDepositOutputMap)].map(TransactionHelper.inputFromOutputId)
    const inputsCommitment = TransactionHelper.getInputsCommitment([...Object.values(outputsMap), ...Object.values(storageDepositOutputMap)]);
    const essence: ITransactionEssence = {
      type: TRANSACTION_ESSENCE_TYPE,
      networkId: TransactionHelper.networkIdFromNetworkName(this.nodeInfo!.protocol.networkName),
      inputs,
      outputs: [output, ...remainders],
      inputsCommitment,
      payload: {
        type: TAGGED_DATA_PAYLOAD_TYPE,
        tag: Converter.utf8ToHex(KEY_NAME_TANGLE, true),
        data: Converter.utf8ToHex(params?.data || '', true)
      }
    };

    const unlocks: UnlockTypes[] = Object.values(outputsMap)
      .map((_, index) => !index ? createUnlock(essence, from.keyPair) : { type: REFERENCE_UNLOCK_TYPE, reference: 0 })
    if (params?.storageDepositSourceAddress) {
      const address = await this.getAddressDetails(params.storageDepositSourceAddress)
      const storageDepUnlocks: UnlockTypes[] = Object.values(storageDepositOutputMap)
        .map((_, index) => !index ? createUnlock(essence, address.keyPair) : { type: REFERENCE_UNLOCK_TYPE, reference: unlocks.length })
      unlocks.push(...storageDepUnlocks)
    }
    const payload: ITransactionPayload = { type: TRANSACTION_PAYLOAD_TYPE, essence, unlocks };
    await setConsumedOutputIds(from.bech32, Object.keys(outputsMap))
    if (params?.storageDepositSourceAddress) {
      await setConsumedOutputIds(params?.storageDepositSourceAddress, Object.keys(storageDepositOutputMap))
    }
    return (await submitBlocks(this.client, [payload]))[0];
  }

  public mintCollection = async (issuerAddress: AddressDetails, collection: Collection, params?: SmrParams) => {
    await this.init()
    const previouslyConsumedOutputIds = (await MnemonicService.getData(issuerAddress.bech32)).consumedOutputIds || []
    const outputsMap = await this.getOutputs(issuerAddress.bech32, previouslyConsumedOutputIds)
    const totalAmount = Object.values(outputsMap).reduce((acc, act) => acc + Number(act.amount), 0)

    const collectionOutput = createNftOutput(issuerAddress, undefined, JSON.stringify(collectionToMetadata(collection)), this.nodeInfo!)
    const remainderAmount = totalAmount - Number(collectionOutput.amount)
    const remainder = packBasicOutput(issuerAddress.bech32, remainderAmount, [], this.nodeInfo!)

    const inputs = Object.keys(outputsMap).map(TransactionHelper.inputFromOutputId)
    const inputsCommitment = TransactionHelper.getInputsCommitment(Object.values(outputsMap));
    const essence: ITransactionEssence = {
      type: TRANSACTION_ESSENCE_TYPE,
      networkId: TransactionHelper.networkIdFromNetworkName(this.nodeInfo!.protocol.networkName),
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
    return (await submitBlocks(this.client, [payload]))[0];
  }

  public mintNfts = async (transaction: Transaction, params?: SmrParams) => {
    await this.init()
    const issuerAddress = await this.getAddressDetails(transaction.payload.sourceAddress)

    const sourceMnemonic = await MnemonicService.getData(issuerAddress.bech32)
    const outputsMap = await this.getOutputs(issuerAddress.bech32, sourceMnemonic.consumedOutputIds)
    const totalAmount = Object.values(outputsMap).reduce((acc, act) => acc + Number(act.amount), 0)

    const collectionOutputs = await this.getNftOutputIds(issuerAddress.bech32, sourceMnemonic.consumedNftOutputIds)
    const nftOutputPromises = (transaction.payload.nfts as string[]).map(async (nftId) => {
      const nft = <Nft>(await admin.firestore().doc(`${COL.NFT}/${nftId}`).get()).data()
      const address = nft.mintingData?.address ? await this.getAddressDetails(nft.mintingData?.address) : (await this.getNewIotaAddressDetails())
      const collectionNftAddress: INftAddress = { type: NFT_ADDRESS_TYPE, nftId: TransactionHelper.resolveIdFromOutputId(Object.keys(collectionOutputs)[0]) }
      const output = createNftOutput(address, collectionNftAddress, JSON.stringify(nftToMetadata(nft)), this.nodeInfo!)
      await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).update({
        'mintingData.address': address.bech32,
        'mintingData.network': transaction.network!,
        'mintingData.storageDeposit': Number(output.amount)
      })
      return output
    })
    const nftOutputs = await Promise.all(nftOutputPromises)
    const nftTotalStorageDeposit = nftOutputs.reduce((acc, act) => acc + Number(act.amount), 0)

    const remainderAmount = totalAmount - nftTotalStorageDeposit
    const remainder = packBasicOutput(issuerAddress.bech32, remainderAmount, [], this.nodeInfo!)

    const inputs = [...Object.keys(collectionOutputs), ...Object.keys(outputsMap)].map(TransactionHelper.inputFromOutputId)
    const inputsCommitment = TransactionHelper.getInputsCommitment([...Object.values(collectionOutputs), ...Object.values(outputsMap)]);
    const outputs = [...Object.values(collectionOutputs), ...nftOutputs]
    const essence: ITransactionEssence = {
      type: TRANSACTION_ESSENCE_TYPE,
      networkId: TransactionHelper.networkIdFromNetworkName(this.nodeInfo!.protocol.networkName),
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

    return (await submitBlocks(this.client, [payload]))[0];
  }

  public changeNftOwner = async (transaction: Transaction, params?: SmrParams) => {
    await this.init()

    const sourceMnemonic = await MnemonicService.getData(transaction.payload.sourceAddress)
    const nftOutputs = await this.getNftOutputIds(transaction.payload.sourceAddress, sourceMnemonic.consumedNftOutputIds)

    const nftOutput = Object.values(nftOutputs)[0]

    const sourceAddress = await this.getAddressDetails(transaction.payload.sourceAddress)
    const targetAddress = Bech32Helper.addressFromBech32(transaction.payload.targetAddress, this.nodeInfo!.protocol.bech32Hrp)
    const output = cloneDeep(nftOutput)
    output.unlockConditions = [{ type: ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress }]

    if (output.nftId === EMPTY_NFT_ID) {
      output.nftId = TransactionHelper.resolveIdFromOutputId(Object.keys(nftOutputs)[0])
    }

    const inputs = Object.keys(nftOutputs).map(TransactionHelper.inputFromOutputId)
    const inputsCommitment = TransactionHelper.getInputsCommitment(Object.values(nftOutputs));
    const essence: ITransactionEssence = {
      type: TRANSACTION_ESSENCE_TYPE,
      networkId: TransactionHelper.networkIdFromNetworkName(this.nodeInfo!.protocol.networkName),
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

    return (await submitBlocks(this.client, [payload]))[0];
  }

  public getLedgerInclusionState = async (id: string) => (await this.client.blockMetadata(id)).ledgerInclusionState

}

const subtractNativeTokens = (output: IBasicOutput, tokens: NativeToken[] | undefined) => {
  if (!output.nativeTokens || !tokens) {
    return output.nativeTokens
  }
  return cloneDeep(output.nativeTokens || []).map(token => {
    const tokenToSubtract = tokens.find(t => t.id === token.id)?.amount
    if (!tokenToSubtract) {
      return token
    }
    return { id: token.id, amount: subtractHex(token.amount, tokenToSubtract) }
  }).filter(nt => Number(nt.amount) !== 0)
}
