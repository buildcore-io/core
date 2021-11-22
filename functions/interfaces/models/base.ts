export interface Timestamp {
  now(): Timestamp;
  fromDate(date: Date): Timestamp;
  fromMillis(milliseconds: number): Timestamp;
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
  isEqual(other: Timestamp): boolean;
  valueOf(): string;
}


export interface WenRequest {
  address: string;
  signature: string;
  body: any;
}

export const enum COL {
  MEMBER = 'member',
  AWARD = 'award',
  SPACE = 'space',
  PROPOSAL = 'proposal',
  TRANSACTION = 'transaction'
}

export const enum SUB_COL {
  OWNERS = 'owners',
  PARTICIPANTS = 'participants',
  MEMBERS = 'members',
  GUARDIANS = 'guardians',
  BLOCKED_MEMBERS = 'blockedMembers',
  KNOCKING_MEMBERS = 'knockingMembers'
}

export const enum AWARD_COL {
  OWNERS = 'owners'
}

export type EthAddress = string;

export interface Base {
  uid: string;
}

export interface BaseSubCollection {
  parentId: string;
  parentCol: string;
}

export interface BaseRecord extends Base {
  createdOn?: Timestamp;
  updatedOn?: Timestamp;
  createdBy?: string;
}
