import { Bip32Path } from "@iota/crypto.js-next";
import {
  addressBalance,
  BASIC_OUTPUT_TYPE,
  Bech32Helper,
  Ed25519Address,
  Ed25519Seed,
  ED25519_ADDRESS_TYPE, IAliasOutput,
  IBasicOutput, IFoundryOutput, IKeyPair,
  IndexerPluginClient,
  INftOutput,
  INodeInfo, ITransactionEssence, ITransactionPayload, IUTXOInput,
  OutputTypes, REFERENCE_UNLOCK_TYPE, sendAdvanced, SingleNodeClient,
  TransactionHelper, TRANSACTION_ESSENCE_TYPE, TRANSACTION_PAYLOAD_TYPE, UTXO_INPUT_TYPE
} from "@iota/iota.js-next";
import { Converter } from '@iota/util.js-next';
import bigInt, { BigInteger } from "big-integer";
import { generateMnemonic } from 'bip39';
import { cloneDeep, isEmpty } from "lodash";
import { KEY_NAME_TANGLE } from "../../../interfaces/config";
import { NativeToken } from "../../../interfaces/models/milestone";
import { mergeOutputs, packBasicOutput, submitBlocks, subtractHex } from "../../utils/basic-output.utils";
import { Bech32AddressHelper } from "../../utils/bech32-address.helper";
import { MnemonicService } from "./mnemonic";
import { createUnlock } from "./token/common.utils";
import { AddressDetails, Wallet } from "./wallet";

interface Input {
  input: IUTXOInput;
  addressKeyPair: IKeyPair;
  consumingOutput: OutputTypes;
}

interface Output {
  address: string;
  addressType: number;
  amount: BigInteger;
}

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

  public sendFromGenesis = async (fromAddress: AddressDetails, toAddress: string, amount: number, data: string) => {
    await this.init();

    const indexerPlugin = new IndexerPluginClient(this.client);
    const genesisAddressOutputs = await indexerPlugin.outputs({ addressBech32: fromAddress.bech32 });

    const inputsWithKeyPairs: Input[] = [];

    let totalGenesis = bigInt(0);

    for (let i = 0; i < genesisAddressOutputs.items.length; i++) {
      const output = await this.client.output(genesisAddressOutputs.items[i]);
      if (!output.metadata.isSpent) {
        inputsWithKeyPairs.push({
          input: {
            type: UTXO_INPUT_TYPE,
            transactionId: output.metadata.transactionId,
            transactionOutputIndex: output.metadata.outputIndex
          },
          addressKeyPair: fromAddress.keyPair,
          consumingOutput: output.output
        });
        if (output.output.type === BASIC_OUTPUT_TYPE) {
          totalGenesis = totalGenesis.plus((output.output as IBasicOutput).amount);
        }
      }
    }

    const outputs: Output[] = [
      // This is the transfer to the new address
      {
        address: await this.convertAddressToHex(toAddress),
        addressType: ED25519_ADDRESS_TYPE,
        amount: bigInt(amount)
      }
    ];
    const reminder = totalGenesis.minus(amount)
    if (reminder > bigInt(0)) {
      // Sending remainder back to genesis
      outputs.push({
        address: fromAddress.hex,
        addressType: ED25519_ADDRESS_TYPE,
        amount: reminder
      });
    }

    const { blockId } = await sendAdvanced(this.client, inputsWithKeyPairs, outputs, {
      tag: Converter.utf8ToBytes(KEY_NAME_TANGLE),
      data: Converter.utf8ToBytes(data)
    });
    return blockId
  }

  private async convertAddressToHex(address: string): Promise<string> {
    await this.init();
    const decodeBench32Target = Bech32Helper.fromBech32(address, this.nodeInfo!.protocol.bech32HRP);
    return Converter.bytesToHex(decodeBench32Target?.addressBytes!, true)
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

  public send = async (from: AddressDetails, toBech32: string, amount: number, nativeToken?: NativeToken) => {
    await this.init()
    const outputsMap = await this.getOutputs(from.bech32)
    const output = packBasicOutput(toBech32, amount, nativeToken, this.nodeInfo!)

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
    const blockId = (await submitBlocks(this.client, [payload]))[0];
    return { blockId, output }
  }

}
