import { Timestamp } from 'firebase/firestore';

export const enum COL {
  MEMBER = 'member',
  AWARD = 'award',
  SPACE = 'space',
  PROPOSAL = 'proposal',
  TRANSACTION = 'proposal'
}

export const enum SUB_COL {
  OWNERS = 'owners',
  PARTICIPANTS = 'participants',
  MEMBERS = 'members',
  GUARDIANS = 'guardians',
  BLOCKED_MEMBERS = 'blockedMembers'
}

export const enum AWARD_COL {
  OWNERS = 'owners'
}

export type EthAddress = string;

export interface Base {
  uid: string;
}

export interface BaseRecord extends Base {
  createdOn?: Timestamp;
  updatedOn?: Timestamp;
}
