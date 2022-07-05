import { SingleNodeClient } from "@iota/iota.js";
import { SingleNodeClient as SmrSingleNodeClient } from "@iota/iota.js-next";
import { Network } from "../../../interfaces/models";
import { getRandomElement } from "../../utils/common.utils";
import { IotaWallet } from "./IotaWalletService";
import { SmrWallet } from "./SmrWalletService";

const RMS_API_ENDPOINTS = ['https://sd1.svrs.io/']
const SMR_API_ENDPOINTS = RMS_API_ENDPOINTS

const getSmrApiEndpoint = (testMode: boolean) => getRandomElement(testMode ? RMS_API_ENDPOINTS : SMR_API_ENDPOINTS)

const IOTA_API_ENDPOINTS = [
  'https://us3.svrs.io/',
  'https://us4.svrs.io/',
  'https://hs5.svrs.io/',
  'https://hs6.svrs.io/',
  'https://chrysalis-nodes.iota.org'
];

const ATOI_API_ENDPOINTS = ['https://devnet.svrs.io/']

const getIOTAApiEndpoint = (testMode: boolean) => getRandomElement(testMode ? ATOI_API_ENDPOINTS : IOTA_API_ENDPOINTS)

export interface IKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface AddressDetails {
  bech32: string;
  keyPair: IKeyPair;
  hex: string;
  mnemonic: string;
}

export interface Wallet {
  getBalance: (addressBech32: string) => Promise<number>;
  getNewIotaAddressDetails: () => Promise<AddressDetails>;
  getIotaAddressDetails: (mnemonic: string) => Promise<AddressDetails>;
  getAddressDetails: (bech32: string) => Promise<AddressDetails>;
  sendFromGenesis: (fromAddress: AddressDetails, toAddress: string, amount: number, data: string) => Promise<string>;
}

export const getNodeClient = (network: Network) => {
  if (network === Network.ATOI || network === Network.IOTA) {
    return new SingleNodeClient(getIOTAApiEndpoint(network === Network.ATOI))
  }
  return new SmrSingleNodeClient(getSmrApiEndpoint(network === Network.RMS))
}

export class WalletService {

  public static newWallet = (network = Network.IOTA): Wallet => {
    switch (network) {
      case Network.IOTA:
        return new IotaWallet(getNodeClient(network) as SingleNodeClient)
      case Network.ATOI:
        return new IotaWallet(getNodeClient(network) as SingleNodeClient)
      case Network.SMR:
        return new SmrWallet(getNodeClient(network) as SmrSingleNodeClient)
      case Network.RMS:
        return new SmrWallet(getNodeClient(network) as SmrSingleNodeClient)
    }
  }

}
