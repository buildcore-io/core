import { Network } from '@build-5/interfaces';
import {
  IMetadataFeature,
  INftOutput,
  METADATA_FEATURE_TYPE,
  SingleNodeClient,
} from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';

const RMS_API_ENDPOINTS = ['https://rms1.svrs.io/'];

const SMR_API_ENDPOINTS = ['https://smr1.svrs.io/', 'https://smr3.svrs.io/'];

export const getShimmerClient = async (network = Network.SMR) => {
  let url = '';
  for (let i = 0; i < 5; ++i) {
    url = getEndpointUrl(network);
    try {
      const client = new SingleNodeClient(url);
      const healty = await client.health();
      if (healty) {
        return client;
      }
    } catch (error) {
      console.warn(`Could not connect to client ${network}`, url, error);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 1000 + 500)));
  }
  console.error(`Could not connect to client ${network}`, url);
  throw Error(`Could not connect to any client ${network}`);
};

const getEndpointUrl = (network: Network) => {
  const urls = network === Network.SMR ? SMR_API_ENDPOINTS : RMS_API_ENDPOINTS;
  return getRandomElement(urls);
};

const getRandomElement = <T>(array: T[]) => array[Math.floor(Math.random() * array.length)];

export const EMPTY_NFT_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';

export const getMutableMetadata = (output: INftOutput) => {
  const hexMetadata = <IMetadataFeature | undefined>(
    output?.features?.find((f) => f.type === METADATA_FEATURE_TYPE)
  );
  if (!hexMetadata?.data) {
    return {};
  }
  const mutableMetadata = JSON.parse(Converter.hexToUtf8(hexMetadata.data) || '{}');
  return mutableMetadata;
};
