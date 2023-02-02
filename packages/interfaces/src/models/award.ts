import { BaseRecord, BaseSubCollection, FileMetedata, Timestamp } from './base';

export enum AwardType {
  PARTICIPATE_AND_APPROVE = 0,
  CUSTOM = 1,
}

export interface AwardParticipant extends BaseSubCollection {
  uid: string;
  comment?: string;
  completed: boolean;
  createdOn: Timestamp;
  count: number;
  xp: number;
}

export interface AwardOwner extends BaseSubCollection {
  uid: string;
  createdOn: Timestamp;
}

export interface AwardBadge {
  name: string;
  description: string;
  image: FileMetedata;
  count: number;
  xp: number;
}

export interface Award extends BaseRecord {
  name: string;
  description: string;
  space: string;
  type: AwardType;
  endDate: Timestamp;
  owners: {
    [propName: string]: AwardOwner;
  };
  participants: {
    [propName: string]: AwardParticipant;
  };
  badge: AwardBadge;
  issued: number;
  approved: boolean;
  rejected: boolean;
}
