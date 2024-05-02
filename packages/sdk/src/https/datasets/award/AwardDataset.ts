import {
  Award,
  AwardAddOwnerRequest,
  AwardApproveParticipantRequest,
  AwardApproveParticipantResponse,
  AwardCancelRequest,
  AwardCreateRequest,
  AwardFundRequest,
  AwardParticipant,
  AwardParticpateRequest,
  AwardRejectRequest,
  BuildcoreRequest,
  Dataset,
  GetManyAdvancedRequest,
  Opr,
  Subset,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { switchMap } from 'rxjs';
import { DatasetClass } from '../Dataset';
import { SubsetType } from '../common';

/**
 * Award HTTPS Dataset object
 */
export class AwardDataset<D extends Dataset> extends DatasetClass<D, Award> {
  /**
   * Create Award
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link AwardCreateRequest}
   * @returns
   */
  create = (req: BuildcoreRequest<AwardCreateRequest>) =>
    this.sendRequest(WEN_FUNC.createAward)<AwardCreateRequest, Award>(req);
  /**
   * Fund award with native or base token.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link AwardFundRequest}
   * @returns
   */
  fund = (req: BuildcoreRequest<AwardFundRequest>) =>
    this.sendRequest(WEN_FUNC.fundAward)<AwardFundRequest, Transaction>(req);
  /**
   * Reject award
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link AwardRejectRequest}
   * @returns
   */
  reject = (req: BuildcoreRequest<AwardRejectRequest>) =>
    this.sendRequest(WEN_FUNC.rejectAward)<AwardRejectRequest, Award>(req);
  /**
   * Add owner of the award. This grants the ability to manage it.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link AwardAddOwnerRequest}
   * @returns
   */
  addOwner = (req: BuildcoreRequest<AwardAddOwnerRequest>) =>
    this.sendRequest(WEN_FUNC.addOwnerAward)<AwardAddOwnerRequest, Award>(req);
  /**
   * Participate in the award to receive badge and tokens.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link AwardParticpateRequest}
   * @returns
   */
  participate = (req: BuildcoreRequest<AwardParticpateRequest>) =>
    this.sendRequest(WEN_FUNC.participateAward)<AwardParticpateRequest, AwardParticipant>(req);
  /**
   * Approve participants and distribute them with token and NFT
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link AwardApproveParticipantRequest}
   * @returns
   */
  approveParticipant = (req: BuildcoreRequest<AwardApproveParticipantRequest>) =>
    this.sendRequest(WEN_FUNC.approveParticipantAward)<
      AwardApproveParticipantRequest,
      AwardApproveParticipantResponse
    >(req);
  /**
   * Cancel ongoing award and get refunded with remaining tokens.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link AwardCancelRequest}
   * @returns
   */
  cancel = (req: BuildcoreRequest<AwardCancelRequest>) =>
    this.sendRequest(WEN_FUNC.cancelAward)<AwardCancelRequest, Award>(req);
  /**
   * Helper GET function to get "active" awards per space. Returns observable with continues updates via Websocket.
   *
   * @param space
   * @param startAfter
   * @returns
   */
  getActiveLive = (space: string, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['space', 'endDate', 'completed', 'approved'],
      fieldValue: [space, new Date().toISOString(), false, true],
      operator: [Opr.EQUAL, Opr.GREATER_OR_EQUAL, Opr.EQUAL, Opr.EQUAL],
      startAfter,
    };
    return this.getManyAdvancedLive(params);
  };

  /**
   * Helper GET function to get "completed" awards per space. Returns observable with continues updates via Websocket.
   *
   * @param space
   * @param startAfter
   * @returns
   */
  getCompletedLive = (space: string, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['space', 'completed', 'approved'],
      fieldValue: [space, true, true],
      operator: [Opr.EQUAL, Opr.EQUAL, Opr.EQUAL],
      startAfter,
    };
    return this.getManyAdvancedLive(params);
  };
  /**
   * Helper GET function to get "draft" awards per space. Returns observable with continues updates via Websocket.
   *
   * @param space
   * @param startAfter
   * @returns
   */
  getDraftLive = (space: string, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['space', 'endDate', 'rejected', 'approved'],
      fieldValue: [space, new Date().toISOString(), false, false],
      operator: [Opr.EQUAL, Opr.GREATER_OR_EQUAL, Opr.EQUAL, Opr.EQUAL],
      startAfter,
    };
    return this.getManyAdvancedLive(params);
  };
  /**
   * Helper GET function to get "rejected" awards per space. Returns observable with continues updates via Websocket.
   *
   * @param space
   * @param startAfter
   * @returns
   */
  getRejectedLive = (space: string, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['space', 'rejected'],
      fieldValue: [space, false],
      operator: [Opr.EQUAL, Opr.EQUAL],
      startAfter,
    };
    return this.getManyAdvancedLive(params);
  };

  /**
   * Helper GET function to get closest finishing awards. Returns observable with continues updates via Websocket.
   *
   * @param startAfter
   * @returns
   */
  getLastActiveLive = (startAfter?: string) => {
    const fieldName = ['endDate', 'completed', 'approved'];
    const fieldValue = [new Date().toISOString(), false, true];
    const operator = [Opr.GREATER_OR_EQUAL, Opr.EQUAL, Opr.EQUAL];
    const orderBy = ['endDate'];
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName,
      fieldValue,
      operator,
      startAfter,
      orderBy,
    };
    return this.getManyAdvancedLive(params);
  };

  /**
   * Helper GET Award participants. Returns observable with continues updates via Websocket.
   *
   * @param startAfter
   * @returns
   */
  getTopByMemberLive = (member: string, completed: boolean, startAfter?: string) => {
    const members = (
      this.subset(Subset.PARTICIPANTS) as SubsetType<Dataset.AWARD, Subset.PARTICIPANTS>
    ).getTopByMemberLive(member, completed, startAfter);
    return members.pipe(
      switchMap(async (members) => {
        const promises = members.map((member) => this.id(member.parentId).get());
        return (await Promise.all(promises)).map((s) => s!);
      }),
    );
  };
}
