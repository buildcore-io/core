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
  statsPerSpace?: {
    [propName: string]: {
      awardsCompleted?: number;
      totalReputation?: number;
    }
  }
  awardsCompleted?: number;
  totalReputation?: number;
}
