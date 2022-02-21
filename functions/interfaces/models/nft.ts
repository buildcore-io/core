import { IotaAddress, Timestamp } from '../../interfaces/models/base';
import { BaseRecord, EthAddress } from "./base";
import { CollectionType } from './collection';

export const MAX_PROPERTIES_COUNT = 25;
export const MAX_STATS_COUNT = 25;
export const PRICE_UNITS: ('Mi'|'Gi')[] = ['Mi', 'Gi'];

export interface PropStats {
  [propName: string]: {
    label: string,
    value: string
  }
}

export interface Nft extends BaseRecord {
  name: string;
  description: string;
  collection: EthAddress;
  owner?: EthAddress;
  ownerAddress?: IotaAddress;
  media: string;
  ipfsMedia: string;
  ipfsMetadata: string;
  availableFrom: Timestamp;
  price: number;
  type: CollectionType;
  space: string;
  url: string;
  approved: boolean;
  rejected: boolean;
  properties: PropStats;
  stats: PropStats;
  placeholderNft: boolean;
}
