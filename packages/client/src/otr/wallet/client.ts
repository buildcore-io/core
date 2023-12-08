import { Network } from '@build-5/interfaces';
import { Client, SecretManager } from '@iota/sdk';
import { mnemonicToSeedSync } from 'bip39';

export const getClient = async (address: string, customNodeUrl = '') => {
  const nodeUrl = customNodeUrl || getNodeUrl(address);
  const client = new Client({ nodes: [nodeUrl] });
  const info = await client.getInfo();
  if (info.nodeInfo.status.isHealthy) {
    return { client, info: info.nodeInfo, nodeUrl };
  }
  throw Error(`Could not connect to client: ${nodeUrl}`);
};

export const getSecretManager = (mnemonic: string) => {
  const seed = mnemonicToSeedSync(mnemonic);
  const hexSeed = '0x' + seed.toString('hex');
  return new SecretManager({ hexSeed });
};

const NODE_URLS: { [key: string]: string } = {
  [Network.IOTA]: 'https://iota.soonaverse.org',
  [Network.SMR]: 'https://smr.soonaverse.org',
};

const getNodeUrl = (address: string) => {
  if (address.startsWith(Network.SMR)) {
    return NODE_URLS[Network.SMR];
  }
  if (address.startsWith(Network.RMS)) {
    // TODO - get rms node url
    return 'https://rms1.svrs.io/';
  }
  if (address.startsWith('iota')) {
    return NODE_URLS[Network.IOTA];
  }
  throw Error('Invalid otr address. Node url not found');
};
