import { BaseRecord } from "./base";

export interface Award extends BaseRecord {
  name: string;
  description: string;
  owners: {
    // Owner / from date
    [propName: string]: Date;
  };
  badge: {
    name: string;
    description: string;
    ipfsCid: string;
    count: number;
    xp: number;
  }
}
