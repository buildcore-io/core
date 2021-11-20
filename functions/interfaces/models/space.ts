import { BaseRecord, BaseSubCollection, Timestamp } from './base';
export interface SpaceGuardian extends BaseSubCollection {
  uid: string;
  createdOn: Timestamp;
}

export interface SpaceMember extends BaseSubCollection {
  uid: string;
  createdOn: Timestamp;
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
