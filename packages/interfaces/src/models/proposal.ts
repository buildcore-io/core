import { BaseRecord, BaseSubCollection, Timestamp } from './base';

export enum BaseProposalAnswerValue {
  YES = 1,
  NO = 0,
}

/**
 * Proposal Types.
 */
export enum ProposalType {
  NATIVE = 0,
  MEMBERS = 1,
  ADD_GUARDIAN = 2,
  REMOVE_GUARDIAN = 3,
  EDIT_SPACE = 4,
  REMOVE_STAKE_REWARD = 5,
}

/**
 * Proposal Member sub collection.
 */
export interface ProposalMember extends BaseSubCollection {
  /**
   * Member ID.
   */
  uid: string;
  /**
   * Member has voted.
   */
  voted?: boolean;
  /**
   * Selected values.
   */
  values?: number[];
  /**
   * Created on.
   */
  createdOn?: Timestamp;
  /**
   * Vote weight
   */
  weight?: number;
  /**
   * Weight per answer.
   */
  weightPerAnswer?: { [key: number]: number };
}

/**
 * Proposal Settings.
 */
export interface ProposalSettings {
  /**
   * Proposal start date.
   */
  startDate: Timestamp;
  /**
   * Proposal end date.
   */
  endDate: Timestamp;
  /**
   * TODODOC duplicate?
   */
  guardiansOnly?: boolean;
  /**
   * Add / Remove guardian vote.
   */
  addRemoveGuardian?: string;
  /**
   * Space update vote.
   */
  spaceUpdateData?: Record<string, unknown>;
  /**
   * TODODOC duplicate?
   */
  onlyGuardians?: boolean;
  /**
   * Stake rewards update vote
   */
  stakeRewardIds?: string[];
  /**
   * TODODOC
   */
  awards?: string[];
}

/**
 * Proposal Answer.
 */
export interface ProposalAnswer {
  /**
   * Answer text
   */
  text: string;
  /**
   * Answer Value
   */
  value: number;
  /**
   * Answer additional info
   */
  additionalInfo: string;
}

/**
 * Proposal Question.
 */
export interface ProposalQuestion {
  /**
   * Proposal Text
   */
  text: string;
  /**
   * Additional info
   */
  additionalInfo: string;
  /**
   * Possible Answers
   */
  answers: ProposalAnswer[];
}

/**
 * Proposal record.
 */
export interface Proposal extends BaseRecord {
  /**
   * Proposal ID.
   */
  uid: string;
  /**
   * Proposal Name.
   */
  name: string;
  /**
   * Proposal additional information.
   */
  additionalInfo?: string;
  /**
   * Space link {@link Space}
   */
  space: string;
  /**
   * If not native vote, members that can vote on the proposal.
   */
  members?: {
    [propName: string]: ProposalMember;
  };
  /**
   * Proposal description.
   */
  description: string;
  /**
   * Proposal Type.
   */
  type: ProposalType;
  /**
   * Proposal Approved
   */
  approved?: boolean;
  /**
   * Proposal Approved By {@link Member}
   */
  approvedBy?: string;
  /**
   * Proposal rejected
   */
  rejected?: boolean;
  /**
   * Proposal rejected by {@link Member}
   */
  rejectedBy?: string;
  /**
   * TODODOC
   */
  eventId?: string;
  /**
   * Proposal Settings
   */
  settings: ProposalSettings;
  /**
   * Proposal total weight
   */
  totalWeight?: number;
  /**
   * Proposal questions.
   */
  questions: ProposalQuestion[];
  /**
   * Proposal results
   */
  results?: any;
  /**
   * Proposal token used for voting {@link Token}
   */
  token?: string;
  /**
   * Proposal completed (used for filtering)
   */
  completed: boolean;
  /**
   * TODODOC
   */
  rank?: number;
}
