import { BaseRecord } from './base';
export interface Space extends BaseRecord {
  name?: string;
  github?: string;
  twitter?: string;
  discord?: string;
  createdBy: string;
  guardians: {
    // Owner / from date
    [propName: string]: {
      createdOn: Date
    };
  };
  members: {
    // Owner / from date
    [propName: string]: {
      createdOn: Date
    };
  }
}
