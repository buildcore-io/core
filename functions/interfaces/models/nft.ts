import { IotaAddress, Timestamp } from '../../interfaces/models/base';
import { BaseRecord, EthAddress } from "./base";
import { CollectionType } from './collection';

export const MAX_PROPERTIES_COUNT = 25;
export const MAX_STATS_COUNT = 25;

export interface Nft extends BaseRecord {
  name: string;
  description: string;
  collection: EthAddress;
  owner?: EthAddress,
  ownerAddress?: IotaAddress;
  media: string;
  ipfsMedia: string;
  availableFrom: Timestamp,
  type: CollectionType,
  space: string;
  price: number;
  url: string;
  properties: any;
  stats: any;
}
