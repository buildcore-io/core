import { BaseRecord, EthAddress, FileMetedata, ValidatedAddress } from './base';

export interface MemberDeprecated extends BaseRecord {
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
