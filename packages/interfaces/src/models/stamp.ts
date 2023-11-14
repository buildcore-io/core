import { BaseRecord, MediaStatus, Timestamp } from './base';
import { Network } from './transaction';

export interface Stamp extends BaseRecord {
  space: string;
  build5Url: string;
  originUri: string;
  checksum: string;
  extension: string;

  bytes: number;
  costPerMb: number;

  network: Network;
  ipfsMedia?: string;
  ipfsRoot?: string;

  expiresAt: Timestamp;
  order: string;
  funded: boolean;
  expired: boolean;

  mediaStatus?: MediaStatus;

  aliasId?: string;
  nftId?: string;
}
