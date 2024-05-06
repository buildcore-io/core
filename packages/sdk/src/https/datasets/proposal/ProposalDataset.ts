import {
  ApproveProposalRequest,
  BuildcoreRequest,
  Dataset,
  GetManyAdvancedRequest,
  Opr,
  Proposal,
  ProposalCreateRequest,
  ProposalVoteRequest,
  RejectProposalRequest,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { DatasetClass } from '../Dataset';

/**
 * Proposal Dataset
 */
export class ProposalDataset<D extends Dataset> extends DatasetClass<D, Proposal> {
  /**
   * Method to create Proposal
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link ProposalCreateRequest}
   * @returns
   */
  create = (req: BuildcoreRequest<ProposalCreateRequest>) =>
    this.sendRequest(WEN_FUNC.createProposal)<ProposalCreateRequest, Proposal>(req);
  /**
   * Method to approve Proposal
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link ApproveProposalRequest}
   * @returns
   */
  approve = (req: BuildcoreRequest<ApproveProposalRequest>) =>
    this.sendRequest(WEN_FUNC.approveProposal)<ApproveProposalRequest, Proposal>(req);
  /**
   * Method to reject Proposal
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link RejectProposalRequest}
   * @returns
   */
  reject = (req: BuildcoreRequest<RejectProposalRequest>) =>
    this.sendRequest(WEN_FUNC.rejectProposal)<RejectProposalRequest, Proposal>(req);
  /**
   * Method to vote on Proposal
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link ProposalVoteRequest}
   * @returns
   */
  vote = (req: BuildcoreRequest<ProposalVoteRequest>) =>
    this.sendRequest(WEN_FUNC.voteOnProposal)<ProposalVoteRequest, Transaction>(req);

  /**
   * TODO
   *
   * @param startAfter
   * @returns
   */
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
  /**
   * TODO
   *
   * @param space
   * @param startAfter
   * @returns
   */
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
  /**
   * TODO
   *
   * @param space
   * @param startAfter
   * @returns
   */
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
  /**
   * TODO
   *
   * @param space
   * @param startAfter
   * @returns
   */
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
  /**
   * TODO
   *
   * @param space
   * @param startAfter
   * @returns
   */
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
