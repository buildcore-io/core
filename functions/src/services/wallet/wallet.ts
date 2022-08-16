import { Network } from "../../../interfaces/models";
import { getIotaClient, IotaWallet } from "./IotaWalletService";
import { getShimmerClient, SmrWallet } from "./SmrWalletService";

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

export interface Wallet<T> {
  getBalance: (addressBech32: string) => Promise<number>;
  getNewIotaAddressDetails: () => Promise<AddressDetails>;
  getIotaAddressDetails: (mnemonic: string) => Promise<AddressDetails>;
  getAddressDetails: (bech32: string) => Promise<AddressDetails>;
  send: (fromAddress: AddressDetails, toAddress: string, amount: number, params?: T) => Promise<string>;
}

export class WalletService {

  public static newWallet = async (network = Network.IOTA) => {
    switch (network) {
      case Network.IOTA:
        return new IotaWallet(await getIotaClient(network), network)
      case Network.ATOI:
        return new IotaWallet(await getIotaClient(network), network)
      case Network.SMR:
        return new SmrWallet(await getShimmerClient(network), network)
      case Network.RMS:
        return new SmrWallet(await getShimmerClient(network), network)
    }
  }

}
