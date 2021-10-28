import { BaseRecord } from './base';
export interface Community extends BaseRecord {
  name: string;
  guardians: {
    // Owner / from date
    [propName: string]: Date;
  };
  members: {
    // Owner / from date
    [propName: string]: Date;
  }
}
