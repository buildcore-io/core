import { Network } from "../../../interfaces/models";
import { Token } from "../../../interfaces/models/token";
import { IotaWallet } from "./IotaWalletService";
import { SmrWallet } from "./SmrWalletService";

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
  sendFromGenesis: (fromAddress: AddressDetails, toAddress: string, amount: number, data: string) => Promise<string>;
  mintToken: (sourceAddressBech: string, targetAddressBech: string, token: Token) => Promise<void>;
  getTokenMintTotalStorageDeposit: (sourceAddressBech: string, targetAddressBech: string, token: Token) => Promise<number>;
}

export class WalletService {

  public static newWallet = (network = Network.IOTA): Wallet => {
    switch (network) {
      case Network.IOTA:
        return new IotaWallet(false)
      case Network.ATOI:
        return new IotaWallet(true)
      case Network.SMR:
        return new SmrWallet(false)
      case Network.RMS:
        return new SmrWallet(true)
    }
  }

}
