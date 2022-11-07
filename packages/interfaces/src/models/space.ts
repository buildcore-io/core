import { BaseRecord, BaseSubCollection, Timestamp, ValidatedAddress } from './base';

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
  open?: boolean;
  github?: string;
  twitter?: string;
  discord?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  createdBy: string;
  totalGuardians: number;
  totalMembers: number;
  totalPendingMembers: number;
  validatedAddress?: ValidatedAddress;
  guardians: {
    // Owner / from date
    [propName: string]: SpaceGuardian;
  };
  members: {
    // Owner / from date
    [propName: string]: SpaceMember;
  };
}