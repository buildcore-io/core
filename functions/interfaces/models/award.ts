import { BaseRecord } from "./base";

export interface Award extends BaseRecord {
  name: string;
  description: string;
  owners: {
    // Owner / from date
    [propName: string]: Date;
  };
  badges: {
    // Badge Id / total iXP
    [propName: string]: number;
  }
}
