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
  Dataset,
  GetManyAdvancedRequest,
  Opr,
  Subset,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { switchMap } from 'rxjs';
import { DatasetClass } from '../Dataset';
import { SubsetType } from '../common';

/**
 * Award HTTPS Dataset object
 */
export class AwardDataset<D extends Dataset> extends DatasetClass<D, Award> {
  /**
   * Create Award
   */
  create = this.sendRequest(WEN_FUNC.createAward)<AwardCreateRequest, Award>;
  /**
   * Fund award with native or base token.
   */
  fund = this.sendRequest(WEN_FUNC.fundAward)<AwardFundRequest, Transaction>;
  /**
   * Reject award
   */
  reject = this.sendRequest(WEN_FUNC.rejectAward)<AwardRejectRequest, Award>;
  /**
   * Add owner of the award. This grants the ability to manage it.
   */
  addOwner = this.sendRequest(WEN_FUNC.addOwnerAward)<AwardAddOwnerRequest, Award>;
  /**
   * Participate in the award to receive badge and tokens.
   */
  participate = this.sendRequest(WEN_FUNC.participateAward)<
    AwardParticpateRequest,
    AwardParticipant
  >;
  /**
   * Approve participants and distribute them with token and NFT
   */
  approveParticipant = this.sendRequest(WEN_FUNC.approveParticipantAward)<
    AwardApproveParticipantRequest,
    AwardApproveParticipantResponse
  >;
  /**
   * Cancel ongoing award and get refunded with remaining tokens.
   */
  cancel = this.sendRequest(WEN_FUNC.cancelAward)<AwardCancelRequest, Award>;
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
