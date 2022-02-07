import { IotaAddress, Timestamp } from '../../interfaces/models/base';
import { BaseRecord, EthAddress } from "./base";
import { CollectionType } from './collection';

export interface Nft extends BaseRecord {
  name: string;
  description: string;
  collection: EthAddress;
  owner?: EthAddress,
  ownerAddress?: IotaAddress;
  image: string;
  availableFrom: Timestamp,
  type: CollectionType,
  space: string;
  price: number;
  url: string;
  properties: any;
  stats: any;
}
