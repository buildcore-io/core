import { BaseRecord, EthAddress } from './base';
export interface Member extends BaseRecord {
  uid: EthAddress;
  name: string;
  linkedIn: string;
  twitter: string;
  facebook: string;
}
