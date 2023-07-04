import { COL, DEFAULT_NETWORK, Network } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { IotaWallet, getIotaClient } from './IotaWalletService';
import { SmrWallet, getShimmerClient } from './SmrWalletService';

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

export interface WalletParams {
  readonly data?: string;
}

export interface SendToManyTargets {
  toAddress: string;
  amount: number;
  customMetadata?: Record<string, unknown>;
}

export interface Wallet<T> {
  getBalance: (addressBech32: string) => Promise<number>;
  getNewIotaAddressDetails: () => Promise<AddressDetails>;
  getIotaAddressDetails: (mnemonic: string) => Promise<AddressDetails>;
  getAddressDetails: (bech32: string) => Promise<AddressDetails>;
  send: (
    fromAddress: AddressDetails,
    toAddress: string,
    amount: number,
    params: T,
  ) => Promise<string>;
  sendToMany: (from: AddressDetails, targets: SendToManyTargets[], params: T) => Promise<string>;
}

export class WalletService {
  public static newWallet = async (network = DEFAULT_NETWORK) => {
    switch (network) {
      case Network.IOTA:
      case Network.ATOI: {
        const { client, info } = await getIotaClient(network);
        return new IotaWallet(client, info, network);
      }
      case Network.SMR:
      case Network.RMS: {
        const { client, info } = await getShimmerClient(network);
        return new SmrWallet(client, info, network);
      }
    }
  };
}

export const setConsumedOutputIds = (
  address: string,
  consumedOutputIds: string[] = [],
  consumedNftOutputIds: string[] = [],
  consumedAliasOutputIds: string[] = [],
) =>
  build5Db()
    .doc(`${COL.MNEMONIC}/${address}`)
    .update({ consumedOutputIds, consumedNftOutputIds, consumedAliasOutputIds });
