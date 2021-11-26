import { Base, BaseRecord, BaseSubCollection, Timestamp } from './base';
export enum ProposalType {
  NATIVE = 0,
  MEMBERS = 1
}

export enum ProposalSubType {
  ONE_MEMBER_ONE_VOTE = 0,
  REPUTATION_WITHIN_SPACE = 1,
  REPUTATION_BASED_ON_BADGE = 2,
  QUADRATIC_BASED_ON_SPACE = 3,
  QUADRATIC_BASED_ON_BADGE = 4
}

export interface ProposalMember extends BaseSubCollection {
  uid: string;
  voted?: boolean;
  values?: number[];
  createdOn: Timestamp;
}

export interface NativeProposalSettings {
  milestoneIndexCommence: number;
  milestoneIndexStart: number;
  milestoneIndexEnd: number;
}

export interface MembersProposalSettings {
  startDate: Timestamp;
  endDate: Timestamp;
  guardiansOnly: boolean;
}

export type ProposalSettings = NativeProposalSettings | MembersProposalSettings;

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
  approved?: boolean;
  rejected?: boolean;
  owners: {
    // Owner / from date
    [propName: string]: Date;
  };
  // TODO Fix typing here.
  settings: any;
  questions: ProposalQuestion[];
  results?: {
    total: number;
    voted: number;
    answers: {
      [propName: number]: number;
    }
  }
}
