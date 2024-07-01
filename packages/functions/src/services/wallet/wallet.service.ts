import { database } from '@buildcore/database';
import { COL, DEFAULT_NETWORK, Network } from '@buildcore/interfaces';
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
  [Network.SMR]: process.env.SMR_NODES!.split(','),
  [Network.RMS]: process.env.RMS_NODES!.split(','),
  [Network.IOTA]: process.env.IOTA_NODES!.split(','),
  [Network.ATOI]: process.env.ATOI_NODES!.split(','),
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
  database()
    .doc(COL.MNEMONIC, address)
    .update({ consumedOutputIds, consumedNftOutputIds, consumedAliasOutputIds });
