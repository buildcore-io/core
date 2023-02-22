// TODO, remove after 0.18 release
import { BaseRecord, BaseSubCollection, FileMetedata, Timestamp } from './base';

export enum AwardTypeDeprecated {
  PARTICIPATE_AND_APPROVE = 0,
  CUSTOM = 1,
}

export interface AwardParticipantDeprecated extends BaseSubCollection {
  uid: string;
  comment?: string;
  completed: boolean;
  createdOn: Timestamp;
  count: number;
  xp: number;
}

export interface AwardOwnerDeprecated extends BaseSubCollection {
  uid: string;
  createdOn: Timestamp;
}

export interface AwardBadgeDeprecated {
  name: string;
  description: string;
  image: FileMetedata;
  count: number;
  xp: number;
}

export interface AwardDeprecated extends BaseRecord {
  name: string;
  description: string;
  space: string;
  type: AwardTypeDeprecated;
  endDate: Timestamp;
  owners: {
    [propName: string]: AwardOwnerDeprecated;
  };
  participants: {
    [propName: string]: AwardParticipantDeprecated;
  };
  badge: AwardBadgeDeprecated;
  issued: number;
  approved: boolean;
  rejected: boolean;
}
