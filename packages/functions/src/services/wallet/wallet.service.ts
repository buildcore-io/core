import { build5Db } from '@build-5/database';
import { COL, DEFAULT_NETWORK, Network } from '@build-5/interfaces';
import { Client } from '@iota/sdk';
import { getRandomIndex } from '../../utils/common.utils';
import { logger } from '../../utils/logger';
import { IotaWallet } from './IotaWalletService';
import { SmrWallet } from './SmrWalletService';
import { Wallet } from './wallet';

export interface AddressDetails {
  bech32: string;
  hex: string;
  mnemonic: string;
}

const NODES = {
  [Network.SMR]: ['https://smr1.svrs.io/', 'https://smr3.svrs.io/'],
  [Network.RMS]: ['https://rms1.svrs.io/', 'https://rms1.svrs.io/'], // Second ulr is for testing purposes,
  [Network.IOTA]: [
    'https://us3.svrs.io/',
    'https://us4.svrs.io/',
    'https://hs5.svrs.io/',
    'https://hs6.svrs.io/',
  ],
  [Network.ATOI]: ['https://rms1.svrs.io/'],
};

export const tangleClients: { [key: string]: Client } = {};

const getClient = async (network: Network, nodeIndexToExclude?: number) => {
  let nodeUrl = '';
  for (let i = 0; i < 5; ++i) {
    const nodeIndex = getRandomIndex(NODES[network], nodeIndexToExclude);
    nodeUrl = NODES[network][nodeIndex];
    try {
      const client = tangleClients[nodeUrl] || new Client({ nodes: [nodeUrl] });
      const info = await client.getInfo();
      if (info.nodeInfo.status.isHealthy) {
        if (!tangleClients[nodeUrl]) {
          tangleClients[nodeUrl] = client;
        }
        return { client, info: info.nodeInfo, nodeIndex, nodeUrl };
      }
    } catch (error) {
      logger.warn(`Could not connect to client error, ${network}`, nodeUrl, error);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 1000 + 500)));
  }
  logger.error(`Could not connect to client error ${network}`, nodeUrl);
  throw Error(`Could not connect to any client ${network}`);
};

export class WalletService {
  public static newWallet = async (
    network = DEFAULT_NETWORK,
    nodeIndexToExclude?: number,
  ): Promise<Wallet> => {
    const { client, info, nodeIndex, nodeUrl } = await getClient(network, nodeIndexToExclude);
    if ([Network.ATOI, Network.IOTA].includes(network)) {
      return new IotaWallet(client, info, nodeIndex, nodeUrl, network);
    }
    return new SmrWallet(client, info, nodeIndex, nodeUrl, network);
  };
}

export const setConsumedOutputIds = (
  address: string,
  consumedOutputIds: string[] = [],
  consumedNftOutputIds: string[] = [],
  consumedAliasOutputIds: string[] = [],
) =>
  build5Db()
    .doc(COL.MNEMONIC, address)
    .update({ consumedOutputIds, consumedNftOutputIds, consumedAliasOutputIds });
