import { Bip32Path } from "@iota/crypto.js";
import {
  Bech32Helper,
  Ed25519Address,
  Ed25519Seed,
  ED25519_ADDRESS_TYPE, IKeyPair, INodeInfo, ISeed, ISigLockedSingleOutput, IUTXOInput, sendAdvanced, SIG_LOCKED_SINGLE_OUTPUT_TYPE, SingleNodeClient, UTXO_INPUT_TYPE
} from "@iota/iota.js";
import { Converter } from '@iota/util.js';
import { generateMnemonic } from 'bip39';

export interface AddressDetails {
  bech32: string;
  keyPair: IKeyPair,
  hex: string,
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

export const MIN_AMOUNT_TO_TRANSFER = 1 * 1000 * 1000;
export const KEY_NAME_TANGLE = 'Soonaverse';

export class WalletService {
  private API_ENDPOINT = "https://chrysalis-nodes.iota.org"; // Mainnet
  // private API_ENDPOINT = 'https://api.lb-0.h.chrysalis-devnet.iota.cafe';   // DEV NET
  private client: SingleNodeClient;

  constructor() {
    this.client = new SingleNodeClient(this.API_ENDPOINT);
  }

  public async getNodeInfo(): Promise<INodeInfo> {
    return (await this.client.info());
  }

  public async getNewIotaAddressDetails(): Promise<AddressDetails> {
    const mnemonic: string = generateMnemonic() + ' ' + generateMnemonic();
    return this.getIotaAddressDetails(mnemonic);
  }

  public async getIotaAddressDetails(mnemonic: string): Promise<AddressDetails> {
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
      bech32: Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, genesisWalletAddress, (await this.getNodeInfo()).bech32HRP)
    };
  }

  public async convertAddressToHex(address: string): Promise<string> {
    const decodeBench32Target = Bech32Helper.fromBech32(address, (await this.getNodeInfo()).bech32HRP);
    const newAddressHex = Converter.bytesToHex(decodeBench32Target!.addressBytes);
    return newAddressHex;
  }

  public async sendFromGenesis(fromAddress: AddressDetails, toAddress: string, amount: number, data: string): Promise<string> {
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
