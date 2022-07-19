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
  TransactionHelper, TRANSACTION_ESSENCE_TYPE, TRANSACTION_PAYLOAD_TYPE
} from "@iota/iota.js-next";
import { Converter } from '@iota/util.js-next';
import { generateMnemonic } from 'bip39';
import { cloneDeep, isEmpty } from "lodash";
import { NativeToken } from "../../../interfaces/models/milestone";
import { mergeOutputs, packBasicOutput, submitBlocks, subtractHex } from "../../utils/basic-output.utils";
import { Bech32AddressHelper } from "../../utils/bech32-address.helper";
import { MnemonicService } from "./mnemonic";
import { createUnlock } from "./token/common.utils";
import { AddressDetails, Wallet } from "./wallet";

export class SmrWallet implements Wallet {
  private nodeInfo?: INodeInfo;

  constructor(public readonly client: SingleNodeClient) { }

  private init = async () => {
    if (!this.nodeInfo) {
      this.nodeInfo = await this.client.info();
    }
  }

  public getBalance = async (addressBech32: string) => {
    const balance = await addressBalance(this.client, addressBech32)
    return Number(balance.balance)
  }

  public getNewIotaAddressDetails = () => this.getIotaAddressDetails(generateMnemonic() + ' ' + generateMnemonic());

  public getIotaAddressDetails = async (mnemonic: string): Promise<AddressDetails> => {
    await this.init();

    const walletSeed = Ed25519Seed.fromMnemonic(mnemonic)
    const walletPath = new Bip32Path("m/44'/4218'/0'/0'/0'");
    const walletAddressSeed = walletSeed.generateSeedFromPath(walletPath);
    const keyPair = walletAddressSeed.keyPair();
    const walletEd25519Address = new Ed25519Address(keyPair.publicKey);
    const walletAddress = walletEd25519Address.toAddress();
    const hex = Converter.bytesToHex(walletAddress, true);
    const bech32 = Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, walletAddress, this.nodeInfo!.protocol.bech32HRP)

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
    const hrp = (await this.client.protocolInfo()).bech32HRP
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

  public send = async (from: AddressDetails, toBech32: string, amount: number, _?: string, nativeToken?: NativeToken, storageReturnAddress?: string) => {
    await this.init()
    const outputsMap = await this.getOutputs(from.bech32)
    const output = packBasicOutput(toBech32, amount, nativeToken, this.nodeInfo!, storageReturnAddress)

    let remainder: IBasicOutput | undefined = mergeOutputs(cloneDeep(Object.values(outputsMap)))
    remainder.nativeTokens = (remainder.nativeTokens || [])
      .map(nt => nt.id === nativeToken?.id ? { ...nt, amount: subtractHex(nt.amount, nativeToken.amount) } : nt)
      .filter(nt => Number(nt.amount) !== 0)
    remainder.amount = (Number(remainder.amount) - Number(output.amount)).toString()
    if (isEmpty(remainder.nativeTokens) && !Number(remainder.amount)) {
      remainder = undefined
    }

    const keys = Object.keys(outputsMap)
    const inputs = keys.map(TransactionHelper.inputFromOutputId)
    const inputsCommitment = TransactionHelper.getInputsCommitment(keys.map(k => outputsMap[k]));

    const essence: ITransactionEssence = {
      type: TRANSACTION_ESSENCE_TYPE,
      networkId: TransactionHelper.networkIdFromNetworkName(this.nodeInfo!.protocol.networkName),
      inputs,
      outputs: remainder ? [output, remainder] : [output],
      inputsCommitment
    };
    const payload: ITransactionPayload = {
      type: TRANSACTION_PAYLOAD_TYPE,
      essence,
      unlocks: Object.values(outputsMap).map((_, index) => !index ? createUnlock(essence, from.keyPair) : { type: REFERENCE_UNLOCK_TYPE, reference: 0 })
    };
    return (await submitBlocks(this.client, [payload]))[0];
  }

}
