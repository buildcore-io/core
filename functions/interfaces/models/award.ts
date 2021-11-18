import { BaseRecord } from "./base";

export enum AwardType {
  PARTICIPATE_AND_APPROVE = 0,
  DISCORD_ACTIVITY = 1,
  GITHUB_ACTIVITY = 2,
  CUSTOM = 3
}

export interface Award extends BaseRecord {
  name: string;
  description: string;
  type: AwardType;
  owners: {
    // Owner / from date
    [propName: string]: Date;
  };
  badge: {
    name: string;
    description: string;
    count: number;
    xp: number;
  },
  issued: number;
}
