import { Units } from '@iota/iota.js';
import { IotaAddress, Timestamp } from '../../interfaces/models/base';
import { BaseRecord, EthAddress } from "./base";
import { CollectionType } from './collection';

export const MAX_PROPERTIES_COUNT = 25;
export const MAX_STATS_COUNT = 25;
export const PRICE_UNITS: Units[] = ['Mi', 'Gi'];

export interface Nft extends BaseRecord {
  name: string;
  description: string;
  collection: EthAddress;
  owner?: EthAddress;
  ownerAddress?: IotaAddress;
  media: string;
  ipfsMedia: string;
  availableFrom: Timestamp;
  price: number;
  type: CollectionType;
  space: string;
  url: string;
  properties: any;
  stats: any;
}
