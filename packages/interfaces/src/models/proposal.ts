import { Base, BaseRecord, BaseSubCollection, Timestamp } from './base';
import { Space } from './space';

export enum BaseProposalAnswerValue {
  YES = 1,
  NO = 0,
}

export enum ProposalType {
  NATIVE = 0,
  MEMBERS = 1,
  ADD_GUARDIAN = 2,
  REMOVE_GUARDIAN = 3,
  EDIT_SPACE = 4,
  REMOVE_STAKE_REWARD = 5,
}

export enum ProposalSubType {
  ONE_MEMBER_ONE_VOTE = 1,
  REPUTATION_BASED_ON_SPACE = 2,
  REPUTATION_BASED_ON_AWARDS = 3,
}

export interface ProposalMember extends BaseSubCollection {
  uid: string;
  voted?: boolean;
  values?: number[];
  createdOn?: Timestamp;
  weight?: number;
  weightPerAnswer?: { [key: number]: number };
}

export interface MembersProposalSettings {
  startDate: Timestamp;
  endDate: Timestamp;
  guardiansOnly: boolean;

  addRemoveGuardian?: string;
  spaceUpdateData?: Space;
}

export type ProposalSettings = MembersProposalSettings;

export interface ProposalAnswer extends Base {
  text: string;
  value: number;
  additionalInfo: string;
}

export interface ProposalQuestion extends Base {
  text: string;
  additionalInfo: string;
  answers: ProposalAnswer[];
}

export interface Proposal extends BaseRecord {
  uid: string;
  name: string;
  additionalInfo?: string;
  space: string;
  members?: {
    [propName: string]: ProposalMember;
  };
  description: string;
  type: ProposalType;
  subType: ProposalSubType;
  approved?: boolean;
  rejected?: boolean;
  eventId?: string;
  owners: {
    // Owner / from date
    [propName: string]: Date;
  };
  // TODO Fix typing here.
  settings: any;
  totalWeight?: number;
  questions: ProposalQuestion[];
  results?: any;
  // Consolidate NATIVE.
  // results?: {
  //   total: number;
  //   voted: number;
  //   answers: {
  //     [propName: number]: number;
  //   }
  // }
  token?: string;
}
