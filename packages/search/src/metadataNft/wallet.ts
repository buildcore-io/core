import {
  Network,
  PROD_AVAILABLE_MINTABLE_NETWORKS,
  TEST_AVAILABLE_MINTABLE_NETWORKS,
} from '@build-5/interfaces';
import { Client, FeatureType, MetadataFeature, NftOutput, hexToUtf8 } from '@iota/sdk';

const NODES = {
  [Network.SMR]: ['https://smr1.svrs.io/', 'https://smr3.svrs.io/'],
  [Network.RMS]: ['https://rms1.svrs.io/'],
  [Network.IOTA]: [
    'https://us3.svrs.io/',
    'https://us4.svrs.io/',
    'https://hs5.svrs.io/',
    'https://hs6.svrs.io/',
  ],
  [Network.ATOI]: ['https://devnet.svrs.io/'],
};

export const getClient = async (network = Network.SMR) => {
  let nodeUrl = '';
  for (let i = 0; i < 5; ++i) {
    nodeUrl = getRandomElement(NODES[network]);
    try {
      const client = new Client({ nodes: [nodeUrl] });
      const info = await client.getInfo();
      if (info.nodeInfo.status.isHealthy) {
        return client;
      }
    } catch (error) {
      console.warn(`Could not connect to client ${network}`, nodeUrl, error);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 1000 + 500)));
  }
  console.error(`Could not connect to client ${network}`, nodeUrl);
  throw Error(`Could not connect to any client ${network}`);
};

const getRandomElement = <T>(array: T[]) => array[Math.floor(Math.random() * array.length)];

export const EMPTY_NFT_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';

export const getMutableMetadata = (output: NftOutput) => {
  const hexMetadata = <MetadataFeature | undefined>(
    output?.features?.find((f) => f.type === FeatureType.Metadata)
  );
  if (!hexMetadata?.data) {
    return {};
  }
  const mutableMetadata = JSON.parse(hexToUtf8(hexMetadata.data) || '{}');
  return mutableMetadata;
};

export const AVAILABLE_NETWORKS = [
  ...PROD_AVAILABLE_MINTABLE_NETWORKS,
  ...TEST_AVAILABLE_MINTABLE_NETWORKS,
];
