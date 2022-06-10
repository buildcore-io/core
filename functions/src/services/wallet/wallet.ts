import { Bip32Path } from "@iota/crypto.js";
import {
  Bech32Helper,
  Ed25519Address,
  Ed25519Seed, ED25519_ADDRESS_TYPE, IKeyPair, IMessage, INodeInfo, ISeed, ISigLockedSingleOutput, IUTXOInput, reattach, sendAdvanced, SIG_LOCKED_SINGLE_OUTPUT_TYPE, SingleNodeClient, UTXO_INPUT_TYPE
} from "@iota/iota.js";
import { Converter } from '@iota/util.js';
import { generateMnemonic } from 'bip39';
import { KEY_NAME_TANGLE } from "../../../interfaces/config";
import { Network } from "../../../interfaces/models";
import { getRandomElement } from "../../utils/common.utils";

export interface AddressDetails {
  bech32: string;
  keyPair: IKeyPair;
  hex: string;
  mnemonic: string;
}

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

// Using IOTA api endpoints until shimmer is live
const SHIMMER_API_ENDPOINTS = IOTA_API_ENDPOINTS

const getApiEndpoint = (network?: Network) => {
  switch (network) {
    case Network.SHIMMER:
      return getRandomElement(SHIMMER_API_ENDPOINTS)
    default:
      return getRandomElement(IOTA_API_ENDPOINTS)
  }
}

export class WalletService {
  private client: SingleNodeClient;
  private nodeInfo?: INodeInfo;

  constructor(readonly network?: Network) {
    this.client = new SingleNodeClient(getApiEndpoint(network));
  }

  public async init(): Promise<void> {
    try {
      this.nodeInfo = await this.getNodeInfo();
    } catch (_e) {
      // We will try again below.
    }

    // Let's switch to slave.
    if (!this.nodeInfo?.isHealthy) {
      this.setSlaveEndPoint();
      this.nodeInfo = await this.getNodeInfo();

      // In this case we don't verify isHealthy anymore as we don't want to end up without node.
      // This will cause delay.
    }

    return;
  }

  public setSlaveEndPoint(): void {
    this.client = new SingleNodeClient(getApiEndpoint(this.network));
  }

  public async getNodeInfo(): Promise<INodeInfo> {
    return this.client.info();
  }

  public async reattach(messageId: string): Promise<{
    message: IMessage;
    messageId: string;
  }> {
    return reattach(this.client, messageId);
  }

  public async getBalance(addressBech32: string): Promise<number> {
    return (await this.client.address(addressBech32))?.balance || 0;
  }

  public async getNewIotaAddressDetails(): Promise<AddressDetails> {
    const mnemonic: string = generateMnemonic() + ' ' + generateMnemonic();
    return this.getIotaAddressDetails(mnemonic);
  }

  public async getIotaAddressDetails(mnemonic: string): Promise<AddressDetails> {
    if (!this.nodeInfo) {
      await this.init();
    }

    const genesisSeed: Ed25519Seed = Ed25519Seed.fromMnemonic(mnemonic);
    const genesisPath: Bip32Path = new Bip32Path("m/44'/4218'/0'/0'/0'");
    const genesisWalletSeed: ISeed = genesisSeed.generateSeedFromPath(genesisPath);
    const genesisWalletKeyPair: IKeyPair = genesisWalletSeed.keyPair();
    const genesisEd25519Address: Ed25519Address = new Ed25519Address(genesisWalletKeyPair.publicKey);
    const genesisWalletAddress: Uint8Array = genesisEd25519Address.toAddress();
    const genesisWalletAddressHex = Converter.bytesToHex(genesisWalletAddress);

    // Return new IOTA Address.
    return {
      mnemonic: mnemonic,
      keyPair: genesisWalletKeyPair,
      hex: genesisWalletAddressHex,
      bech32: Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, genesisWalletAddress, this.nodeInfo?.bech32HRP!)
    };
  }

  public async convertAddressToHex(address: string): Promise<string> {
    if (!this.nodeInfo) {
      await this.init();
    }

    const decodeBench32Target = Bech32Helper.fromBech32(address, this.nodeInfo?.bech32HRP!);
    return Converter.bytesToHex(decodeBench32Target?.addressBytes!)
  }

  public async sendFromGenesis(fromAddress: AddressDetails, toAddress: string, amount: number, data: string): Promise<string> {
    if (!this.nodeInfo) {
      await this.init();
    }

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
}
