import { BaseRecord, BaseSubCollection } from "./base";

export enum AwardType {
  PARTICIPATE_AND_APPROVE = 0,
  DISCORD_ACTIVITY = 1,
  GITHUB_ACTIVITY = 2,
  CUSTOM = 3
}

export interface AwardParticipant extends BaseSubCollection {
  uid: string;
  createdOn: Date;
}

export interface AwardOwner extends BaseSubCollection {
  uid: string;
  createdOn: Date;
}

export interface Award extends BaseRecord {
  name: string;
  description: string;
  space: string;
  type: AwardType;
  endDate: string;
  owners: {
    [propName: string]: AwardOwner;
  };
  participants: {
    [propName: string]: AwardParticipant;
  },
  badge: {
    name: string;
    description: string;
    count: number;
    xp: number;
  },
  issued: number;
}
