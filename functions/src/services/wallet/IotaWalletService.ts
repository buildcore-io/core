import { Bip32Path } from "@iota/crypto.js";
import {
  Bech32Helper,
  Ed25519Address,
  Ed25519Seed,
  ED25519_ADDRESS_TYPE,
  IKeyPair,
  INodeInfo,
  ISigLockedSingleOutput,
  IUTXOInput,
  sendAdvanced,
  SIG_LOCKED_SINGLE_OUTPUT_TYPE,
  SingleNodeClient, UTXO_INPUT_TYPE
} from "@iota/iota.js";
import { Converter } from '@iota/util.js';
import { generateMnemonic } from 'bip39';
import { KEY_NAME_TANGLE } from "../../../interfaces/config";
import { getRandomElement } from "../../utils/common.utils";
import { AddressDetails, Wallet } from "./wallet";

interface Input {
  input: IUTXOInput;
  addressKeyPair: IKeyPair;
}

interface Output {
  address: string;
  addressType: number;
  amount: number;
}

const IOTA_API_ENDPOINTS = [
  'https://us3.svrs.io/',
  'https://us4.svrs.io/',
  'https://hs5.svrs.io/',
  'https://hs6.svrs.io/',
  'https://chrysalis-nodes.iota.org'
];

const ATOI_API_ENDPOINTS = ['https://devnet.svrs.io/']

const getApiEndpoint = (testMode: boolean) => getRandomElement(testMode ? ATOI_API_ENDPOINTS : IOTA_API_ENDPOINTS)

export class IotaWallet implements Wallet {
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

  public getBalance = async (addressBech32: string) =>
    (await this.client.address(addressBech32))?.balance || 0;

  public getNewIotaAddressDetails = () => this.getIotaAddressDetails(generateMnemonic() + ' ' + generateMnemonic());

  public getIotaAddressDetails = async (mnemonic: string): Promise<AddressDetails> => {
    await this.init();

    const genesisSeed = Ed25519Seed.fromMnemonic(mnemonic);
    const genesisPath = new Bip32Path("m/44'/4218'/0'/0'/0'");
    const genesisWalletSeed = genesisSeed.generateSeedFromPath(genesisPath);
    const keyPair = genesisWalletSeed.keyPair();
    const genesisEd25519Address = new Ed25519Address(keyPair.publicKey);
    const genesisWalletAddress = genesisEd25519Address.toAddress();
    const hex = Converter.bytesToHex(genesisWalletAddress);
    const bech32 = Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, genesisWalletAddress, this.nodeInfo?.bech32HRP!)

    return { mnemonic, bech32, keyPair, hex };
  }

  public sendFromGenesis = async (fromAddress: AddressDetails, toAddress: string, amount: number, data: string) => {
    await this.init();

    const genesisAddressOutputs = await this.client.addressEd25519Outputs(fromAddress.hex);
    const inputsWithKeyPairs: Input[] = [];
    let totalGenesis = 0;
    for (let i = 0; i < genesisAddressOutputs.outputIds.length; i++) {
      const output = await this.client.output(genesisAddressOutputs.outputIds[i]);
      if (!output.isSpent) {
        inputsWithKeyPairs.push({
          input: {
            type: UTXO_INPUT_TYPE,
            transactionId: output.transactionId,
            transactionOutputIndex: output.outputIndex
          },
          addressKeyPair: fromAddress.keyPair
        });
        if (output.output.type === SIG_LOCKED_SINGLE_OUTPUT_TYPE) {
          totalGenesis += (output.output as ISigLockedSingleOutput).amount;
        }
      }
    }

    const outputs: Output[] = [
      // This is the transfer to the new address
      {
        address: await this.convertAddressToHex(toAddress),
        addressType: ED25519_ADDRESS_TYPE,
        amount: amount
      }
    ];
    const reminder: number = totalGenesis - amount;
    if (reminder > 0) {
      // Sending remainder back to genesis
      outputs.push({
        address: fromAddress.hex,
        addressType: ED25519_ADDRESS_TYPE,
        amount: totalGenesis - amount
      });
    }

    const { messageId } = await sendAdvanced(this.client, inputsWithKeyPairs, outputs, {
      key: Converter.utf8ToBytes(KEY_NAME_TANGLE),
      data: Converter.utf8ToBytes(data)
    });

    return messageId;
  }

  private async convertAddressToHex(address: string): Promise<string> {
    await this.init();
    const decodeBench32Target = Bech32Helper.fromBech32(address, this.nodeInfo?.bech32HRP!);
    return Converter.bytesToHex(decodeBench32Target?.addressBytes!)
  }
}
