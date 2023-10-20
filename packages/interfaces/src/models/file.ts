import { BaseRecord } from './base';

/**
 * File record.
 */
export interface File extends BaseRecord {
  // none yet
  uid: string;
  ipfsCid: string;
}

export enum ImageWidth {
  tb = '200',
  md = '680',
  lg = '1600',
}
