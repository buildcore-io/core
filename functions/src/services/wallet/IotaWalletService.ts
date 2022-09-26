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
import * as functions from 'firebase-functions';
import { KEY_NAME_TANGLE } from "../../../interfaces/config";
import { Network } from "../../../interfaces/models";
import { getRandomElement } from "../../utils/common.utils";
import { MnemonicService } from "./mnemonic";
import { AddressDetails, setConsumedOutputIds, Wallet, WalletParams } from "./wallet";

const IOTA_API_ENDPOINTS = [
  'https://us3.svrs.io/',
  'https://us4.svrs.io/',
  'https://hs5.svrs.io/',
  'https://hs6.svrs.io/',
  'https://chrysalis-nodes.iota.org'
];

const ATOI_API_ENDPOINTS = ['https://devnet.svrs.io/']

const getEndpointUrl = (network: Network) => {
  const urls = network === Network.IOTA ? IOTA_API_ENDPOINTS : ATOI_API_ENDPOINTS
  return getRandomElement(urls)
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

export const getIotaClient = async (network: Network) => {
  let url = ''
  for (let i = 0; i < 5; ++i) {
    url = getEndpointUrl(network)
    try {
      const client = new SingleNodeClient(getEndpointUrl(network))
      const healty = await client.health()
      if (healty) {
        return { client, info: await client.info() }
      }
    } catch (error) {
      functions.logger.warn(`Could not connect to client ${network}`, url, error)
    }
  }
  functions.logger.error(`Could not connect to client ${network}`, url)
  throw Error(`Could not connect to any client ${network}`)
}

export class IotaWallet implements Wallet<WalletParams> {

  constructor(
    public readonly client: SingleNodeClient,
    public readonly info: INodeInfo,
    private readonly network: Network
  ) { }

  public getBalance = async (addressBech32: string) =>
    (await this.client.address(addressBech32))?.balance || 0;

  public getNewIotaAddressDetails = async () => {
    const address = await this.getIotaAddressDetails(generateMnemonic() + ' ' + generateMnemonic());
    await MnemonicService.store(address.bech32, address.mnemonic, this.network)
    return address
  }

  public getIotaAddressDetails = async (mnemonic: string): Promise<AddressDetails> => {
    const genesisSeed = Ed25519Seed.fromMnemonic(mnemonic);
    const genesisPath = new Bip32Path("m/44'/4218'/0'/0'/0'");
    const genesisWalletSeed = genesisSeed.generateSeedFromPath(genesisPath);
    const keyPair = genesisWalletSeed.keyPair();
    const genesisEd25519Address = new Ed25519Address(keyPair.publicKey);
    const genesisWalletAddress = genesisEd25519Address.toAddress();
    const hex = Converter.bytesToHex(genesisWalletAddress);
    const bech32 = Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, genesisWalletAddress, this.info?.bech32HRP!)

    return { mnemonic, bech32, keyPair, hex };
  }

  public getAddressDetails = async (bech32: string) => {
    const mnemonic = await MnemonicService.get(bech32)
    return this.getIotaAddressDetails(mnemonic)
  }

  public send = async (fromAddress: AddressDetails, toAddress: string, amount: number, params: WalletParams) => {
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
        address: this.convertAddressToHex(toAddress),
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

    await setConsumedOutputIds(fromAddress.bech32, genesisAddressOutputs.outputIds)
    const { messageId } = await sendAdvanced(this.client, inputsWithKeyPairs, outputs, {
      key: Converter.utf8ToBytes(KEY_NAME_TANGLE),
      data: Converter.utf8ToBytes(params.data || '')
    });
    return messageId;
  }

  public sendToMany = async (from: AddressDetails, targets: { toAddress: string; amount: number }[], params: WalletParams) => {
    const consumedOutputIds = (await this.client.addressEd25519Outputs(from.hex)).outputIds;
    const outputPromises = consumedOutputIds.map(id => this.client.output(id))
    const consumedOutputResponses = (await Promise.all(outputPromises))
    const total = consumedOutputResponses.reduce((acc, act) => acc + act.output.amount, 0)

    const inputs: Input[] = consumedOutputResponses.map(output => ({
      input: {
        type: UTXO_INPUT_TYPE,
        transactionId: output.transactionId,
        transactionOutputIndex: output.outputIndex
      },
      addressKeyPair: from.keyPair
    }))

    const outputs = targets.map(target => ({
      address: this.convertAddressToHex(target.toAddress),
      addressType: ED25519_ADDRESS_TYPE,
      amount: target.amount
    }))
    const outputsTotal = outputs.reduce((acc, act) => acc + act.amount, 0)

    const remainderAmount = total - outputsTotal
    const remainder = remainderAmount > 0 ? {
      address: from.hex,
      addressType: ED25519_ADDRESS_TYPE,
      amount: remainderAmount
    } : undefined

    await setConsumedOutputIds(from.bech32, consumedOutputIds)
    const { messageId } = await sendAdvanced(this.client, inputs, remainder ? [...outputs, remainder] : outputs, {
      key: Converter.utf8ToBytes(KEY_NAME_TANGLE),
      data: Converter.utf8ToBytes(params.data || '')
    });
    return messageId;
  }


  public getLedgerInclusionState = async (id: string) => (await this.client.messageMetadata(id)).ledgerInclusionState

  private convertAddressToHex(address: string) {
    const decodeBench32Target = Bech32Helper.fromBech32(address, this.info?.bech32HRP!);
    return Converter.bytesToHex(decodeBench32Target?.addressBytes!)
  }
}
