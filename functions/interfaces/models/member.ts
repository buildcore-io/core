import { BaseRecord, EthAddress } from './base';
export interface Member extends BaseRecord {
  uid: EthAddress;
  name?: string;
  about?: string;
  linkedIn?: string;
  twitter?: string;
  github?: string;
  awardsCompleted?: number;
  totalReputation?: number;
}
