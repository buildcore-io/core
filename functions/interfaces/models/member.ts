import { BaseRecord, EthAddress, FileMetedata } from './base';
export interface Member extends BaseRecord {
  uid: EthAddress;
  nonce?: string;
  name?: string;
  about?: string;
  currentProfileImage?: FileMetedata;
  discord?: string;
  twitter?: string;
  github?: string;
  awardsCompleted?: number;
  totalReputation?: number;
}
