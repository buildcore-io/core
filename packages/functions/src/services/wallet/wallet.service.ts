import { COL, DEFAULT_NETWORK, NativeToken, Network } from '@build-5/interfaces';
import { SingleNodeClient } from '@iota/iota.js-next';
import * as functions from 'firebase-functions/v2';
import { build5Db } from '../../firebase/firestore/build5Db';
import { getRandomElement } from '../../utils/common.utils';
import { IotaWallet } from './IotaWalletService';
import { SmrWallet } from './SmrWalletService';
import { Wallet } from './wallet';

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

export interface SendToManyTargets {
  toAddress: string;
  amount: number;
  customMetadata?: Record<string, unknown>;
  nativeTokens?: NativeToken[];
}

const NODES = {
  [Network.SMR]: ['https://smr1.svrs.io/', 'https://smr3.svrs.io/'],
  [Network.RMS]: ['https://rms1.svrs.io/'],
  [Network.IOTA]: [
    'https://us3.svrs.io/',
    'https://us4.svrs.io/',
    'https://hs5.svrs.io/',
    'https://hs6.svrs.io/',
    'https://chrysalis-nodes.iota.org',
  ],
  [Network.ATOI]: ['https://devnet.svrs.io/'],
};

const getClient = async (network: Network) => {
  let nodeUrl = '';
  for (let i = 0; i < 5; ++i) {
    nodeUrl = getRandomElement(NODES[network]);
    try {
      const client = new SingleNodeClient(nodeUrl);
      const healty = await client.health();
      if (healty) {
        return { client, info: await client.info() };
      }
    } catch (error) {
      functions.logger.warn(`Could not connect to client ${network}`, nodeUrl, error);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 1000 + 500)));
  }
  functions.logger.error(`Could not connect to client ${network}`, nodeUrl);
  throw Error(`Could not connect to any client ${network}`);
};

const wallets: { [network: string]: Wallet } = {};

export class WalletService {
  public static newWallet = async (network = DEFAULT_NETWORK): Promise<Wallet> => {
    const { client, info } = await getClient(network);
    if (wallets[network]) {
      return wallets[network];
    }
    if ([Network.ATOI, Network.IOTA].includes(network)) {
      wallets[network] = new IotaWallet(client, info, network);
    } else if ([Network.RMS, Network.SMR].includes(network)) {
      wallets[network] = new SmrWallet(client, info, network);
    }
    return wallets[network];
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
