import { BaseRecord } from './base';
export interface SpaceGuardian {
  uid: string;
  createdOn: Date;
}

export interface SpaceMember {
  uid: string;
  createdOn: Date;
}

export interface Space extends BaseRecord {
  name?: string;
  about?: string;
  github?: string;
  twitter?: string;
  discord?: string;
  createdBy: string;
  totalGuardians: number;
  totalMembers: number;
  guardians: {
    // Owner / from date
    [propName: string]: SpaceGuardian;
  };
  members: {
    // Owner / from date
    [propName: string]: SpaceMember;
  }
}
