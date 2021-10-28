import { BaseRecord } from './base';
export interface Member extends BaseRecord {
  name: string;
  linkedIn: string;
  twitter: string;
  facebook: string;
}
