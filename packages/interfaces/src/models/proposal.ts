import { BaseRecord, BaseSubCollection, Timestamp } from './base';

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

export interface ProposalMember extends BaseSubCollection {
  uid: string;
  voted?: boolean;
  values?: number[];
  createdOn?: Timestamp;
  weight?: number;
  weightPerAnswer?: { [key: number]: number };
}

export interface ProposalSettings {
  startDate: Timestamp;
  endDate: Timestamp;
  guardiansOnly?: boolean;

  addRemoveGuardian?: string;
  spaceUpdateData?: Record<string, unknown>;
  onlyGuardians?: boolean;

  stakeRewardIds?: string[];
  awards?: string[];
}

export interface ProposalAnswer {
  text: string;
  value: number;
  additionalInfo: string;
}

export interface ProposalQuestion {
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
  approvedBy?: string;
  rejected?: boolean;
  rejectedBy?: string;

  eventId?: string;
  settings: ProposalSettings;
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
  completed?: boolean;
  rank?: number;
}
