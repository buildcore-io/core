import { Bip32Path } from "@iota/crypto.js-next";
import {
  BASIC_OUTPUT_TYPE,
  Bech32Helper,
  Ed25519Address,
  Ed25519Seed,
  ED25519_ADDRESS_TYPE,
  getBalance,
  IBasicOutput, IKeyPair,
  IndexerPluginClient,
  INodeInfo, IUTXOInput,
  OutputTypes, sendAdvanced, SingleNodeClient,
  UTXO_INPUT_TYPE
} from "@iota/iota.js-next";
import { Converter } from '@iota/util.js-next';
import bigInt, { BigInteger } from "big-integer";
import { generateMnemonic } from 'bip39';
import { KEY_NAME_TANGLE } from "../../../interfaces/config";
import { Token } from "../../../interfaces/models/token";
import { getRandomElement } from "../../utils/common.utils";
import { MnemonicService } from "./mnemonic";
import { SmrTokenMinter } from "./SmrTokenMinter";
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

const RMS_API_ENDPOINTS = ['https://sd1.svrs.io/']
const SMR_API_ENDPOINTS = RMS_API_ENDPOINTS

const getApiEndpoint = (testMode: boolean) => getRandomElement(testMode ? RMS_API_ENDPOINTS : SMR_API_ENDPOINTS)

export class SmrWallet implements Wallet {
  private client: SingleNodeClient;
  private nodeInfo?: INodeInfo;

  constructor(readonly testMode: boolean) {
    this.client = new SingleNodeClient(getApiEndpoint(testMode));
  }

  private init = async () => {
    if (!this.nodeInfo) {
      this.nodeInfo = await this.client.info();
    }
  }

  public getBalance = async (addressBech32: string) => {
    const mnemonic = await MnemonicService.get(addressBech32)
    const walletSeed = Ed25519Seed.fromMnemonic(mnemonic)
    const balance = await getBalance(this.client, walletSeed, 0)
    return Number(balance)
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

  public pubKeyHashToBech = async (publicKeyHash: string) => {
    await this.init();
    const publicKey = Converter.hexToBytes(publicKeyHash)
    return Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, publicKey, this.nodeInfo!.protocol.bech32HRP)
  }

  public output = (outputId: string) => this.client.output(outputId)

  public mintToken = async (sourceBech32: string, targetBech32: string, token: Token) => {
    await this.init();
    const minter = new SmrTokenMinter(this.client, this.nodeInfo!)
    const sourceDetails = await this.getAddressDetails(sourceBech32)
    const targetDetails = await this.getAddressDetails(targetBech32)
    return await minter.mintToken(sourceDetails, targetDetails, token)
  }

  public getTokenMintTotalStorageDeposit = async (sourceBech32: string, targetBech32: string, token: Token) => {
    await this.init();
    const minter = new SmrTokenMinter(this.client, this.nodeInfo!)
    const sourceDetails = await this.getAddressDetails(sourceBech32)
    const targetDetails = await this.getAddressDetails(targetBech32)
    return await minter.getTotalStorageDeposit(sourceDetails, targetDetails, token)
  }

  private getAddressDetails = async (bech32: string) => {
    const mnemonic = await MnemonicService.get(bech32)
    return this.getIotaAddressDetails(mnemonic)
  }
}
