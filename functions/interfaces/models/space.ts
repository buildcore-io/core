import { BaseRecord, BaseSubCollection } from './base';
export interface SpaceGuardian {
  uid: string;
  createdOn: Date;
}

export interface SpaceMember extends BaseSubCollection {
  uid: string;
  createdOn: Date;
}

export interface Space extends BaseRecord {
  name?: string;
  about?: string;
  github?: string;
  twitter?: string;
  discord?: string;
  avatarUrl?: string;
  bannerUrl?: string;
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
