import { Base, BaseRecord } from './base';
import { SpaceMember } from './space';
export enum ProposalType {
  NATIVE = 0,
  MEMBERS = 1
}

export interface NativeProposalSettings {
  beginMilestone: number;
  startMilestone: number;
  endMilestone: number;
}

export interface MembersProposalSettings {
  // none yet.
  guardiansOnly: boolean;
  members:  {
    [propName: string]: SpaceMember;
  };
}

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
  description: string;
  type: ProposalType;
  owners: {
    // Owner / from date
    [propName: string]: Date;
  };
  settings: NativeProposalSettings|MembersProposalSettings;
  questions: ProposalQuestion[];
}
