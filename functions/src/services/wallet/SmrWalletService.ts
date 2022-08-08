import { Bip32Path } from "@iota/crypto.js-next";
import {
  addressBalance,
  BASIC_OUTPUT_TYPE,
  Bech32Helper,
  Ed25519Address,
  Ed25519Seed,
  ED25519_ADDRESS_TYPE, IAliasOutput,
  IBasicOutput, IFoundryOutput, IndexerPluginClient,
  INftOutput,
  INodeInfo, ITransactionEssence, ITransactionPayload, REFERENCE_UNLOCK_TYPE, SingleNodeClient,
  TransactionHelper, TRANSACTION_ESSENCE_TYPE, TRANSACTION_PAYLOAD_TYPE, UnlockTypes
} from "@iota/iota.js-next";
import { Converter } from '@iota/util.js-next';
import { generateMnemonic } from 'bip39';
import { cloneDeep, isEmpty } from "lodash";
import { Network } from "../../../interfaces/models";
import { Timestamp } from "../../../interfaces/models/base";
import { NativeToken } from "../../../interfaces/models/milestone";
import { mergeOutputs, packBasicOutput, subtractHex } from "../../utils/basic-output.utils";
import { Bech32AddressHelper } from "../../utils/bech32-address.helper";
import { submitBlocks } from "../../utils/block.utils";
import { getRandomElement } from "../../utils/common.utils";
import { createUnlock } from "../../utils/smr.utils";
import { MnemonicService } from "./mnemonic";
import { AddressDetails, Wallet } from "./wallet";

const RMS_API_ENDPOINTS = ['https://sd1.svrs.io/', 'https://sd2.svrs.io/', 'https://sd3.svrs.io/']
const SMR_API_ENDPOINTS = RMS_API_ENDPOINTS

export const getEndpointUrl = (network: Network) => {
  const urls = network === Network.SMR ? SMR_API_ENDPOINTS : RMS_API_ENDPOINTS
  return getRandomElement(urls)
}

export interface SmrParams {
  readonly storageDepositSourceAddress?: string;
  readonly nativeTokens?: NativeToken[];
  readonly storageReturnAddress?: string;
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
    } catch { }
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

  public getOutputs = async (addressBech32: string) => {
    const indexer = new IndexerPluginClient(this.client)
    const query = {
      addressBech32,
      hasStorageReturnCondition: false,
      hasExpirationCondition: false,
      hasTimelockCondition: false,
    }
    const outputIds = (await indexer.outputs(query)).items
    const outputs: { [key: string]: IBasicOutput } = {}
    for (const id of outputIds) {
      const output = (await this.client.output(id)).output
      if (output.type === BASIC_OUTPUT_TYPE) {
        outputs[id] = output
      }
    }
    return outputs
  }

  public send = async (from: AddressDetails, toBech32: string, amount: number, params?: SmrParams) => {
    await this.init()
    const outputsMap = await this.getOutputs(from.bech32)
    const output = packBasicOutput(toBech32, amount, params?.nativeTokens, this.nodeInfo!, params?.storageReturnAddress, params?.vestingAt)

    const remainders: IBasicOutput[] = []

    let storageDepositOutputMap: { [key: string]: IBasicOutput } = {}
    if (params?.storageDepositSourceAddress) {
      storageDepositOutputMap = await this.getOutputs(params.storageDepositSourceAddress)
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
      inputsCommitment
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
    return (await submitBlocks(this.client, [payload]))[0];
  }

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
  })
    .filter(nt => Number(nt.amount) !== 0)
}
