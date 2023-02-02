import { BaseRecord, EthAddress, FileMetedata, Timestamp, ValidatedAddress } from './base';

export interface Member extends BaseRecord {
  uid: EthAddress;
  nonce?: string;
  name?: string;
  about?: string;
  currentProfileImage?: FileMetedata;
  discord?: string;
  twitter?: string;
  github?: string;
  spaces?: {
    [propName: string]: {
      uid: string;
      createdOn?: Timestamp;
      updatedOn?: Timestamp;
      isMember?: boolean;
      badges: string[];
      awardsCompleted?: number;
      totalReputation?: number;
    };
  };
  alliances?: string[];
  awardsCompleted?: number;
  totalReputation?: number;
  validatedAddress?: ValidatedAddress;
  prevValidatedAddresses?: string[];
  tokenTradingFeePercentage?: number;
  tokenPurchaseFeePercentage?: number;
}
