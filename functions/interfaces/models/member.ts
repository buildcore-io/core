import { BaseRecord, EthAddress } from './base';
export interface Member extends BaseRecord {
  uid: EthAddress;
  nonce?: string;
  name?: string;
  about?: string;
  linkedin?: string;
  twitter?: string;
  github?: string;
  awardsCompleted?: number;
  totalReputation?: number;
}
