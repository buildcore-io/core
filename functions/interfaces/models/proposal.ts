import { Base, BaseRecord, BaseSubCollection } from './base';
export enum ProposalType {
  NATIVE = 0,
  MEMBERS = 1
}

export interface ProposalMember extends BaseSubCollection {
  uid: string;
  createdOn: Date;
}

export interface NativeProposalSettings {
  milestoneIndexCommence: number;
  milestoneIndexStart: number;
  milestoneIndexEnd: number;
}

export interface MembersProposalSettings {
  startDate: string;
  endDate: string;
  guardiansOnly: boolean;
  members:  {
    [propName: string]: ProposalMember;
  };
}

export type ProposalSettings = NativeProposalSettings | MembersProposalSettings;

export interface ProposalAnswer extends Base {
  name: string;
  description: string;
}

export interface ProposalQuestion extends Base {
  name: string;
  description: string;
  answers: ProposalAnswer[];
}

export interface Proposal extends BaseRecord {
  uid: string;
  name: string;
  additionalInfo?: string;
  space: string;
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
}
