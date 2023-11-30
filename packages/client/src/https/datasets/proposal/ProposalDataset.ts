import {
  ApproveProposalRequest,
  Dataset,
  GetManyAdvancedRequest,
  Opr,
  Proposal,
  ProposalCreateRequest,
  ProposalVoteRequest,
  RejectProposalRequest,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from '../Dataset';

export class ProposalDataset<D extends Dataset> extends DatasetClass<D, Proposal> {
  create = this.sendRequest(WEN_FUNC.createProposal)<ProposalCreateRequest>;

  approve = this.sendRequest(WEN_FUNC.approveProposal)<ApproveProposalRequest>;

  reject = this.sendRequest(WEN_FUNC.rejectProposal)<RejectProposalRequest>;

  vote = this.sendRequest(WEN_FUNC.voteOnProposal)<ProposalVoteRequest>;

  getAllActiveLive = (startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['settings.endDate', 'approved'],
      fieldValue: [new Date().toISOString(), true],
      operator: [Opr.GREATER_OR_EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['settings.endDate'],
      orderByDir: ['asc'],
    };
    return this.getManyAdvancedLive(params);
  };

  getActiveLive = (space: string, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['space', 'settings.endDate', 'approved'],
      fieldValue: [space, new Date().toISOString(), true],
      operator: [Opr.EQUAL, Opr.GREATER_OR_EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['settings.endDate'],
      orderByDir: ['asc'],
    };
    return this.getManyAdvancedLive(params);
  };

  getCompletedLive = (space: string, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['space', 'settings.endDate', 'approved'],
      fieldValue: [space, new Date().toISOString(), true],
      operator: [Opr.EQUAL, Opr.LESS_OR_EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['settings.endDate'],
      orderByDir: ['asc'],
    };
    return this.getManyAdvancedLive(params);
  };

  getDraftLive = (space: string, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['space', 'rejected', 'approved'],
      fieldValue: [space, false, true],
      operator: [Opr.EQUAL, Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: [],
      orderByDir: [],
    };
    return this.getManyAdvancedLive(params);
  };

  getRejectedLive = (space: string, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['space', 'rejected'],
      fieldValue: [space, true],
      operator: [Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: [],
      orderByDir: [],
    };
    return this.getManyAdvancedLive(params);
  };
}
