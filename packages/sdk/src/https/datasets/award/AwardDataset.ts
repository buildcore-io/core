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
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from '../Dataset';

export class AwardDataset<D extends Dataset> extends DatasetClass<D, Award> {
  create = this.sendRequest(WEN_FUNC.createAward)<AwardCreateRequest, Award>;

  fund = this.sendRequest(WEN_FUNC.fundAward)<AwardFundRequest, Transaction>;

  rejec = this.sendRequest(WEN_FUNC.rejectAward)<AwardRejectRequest, Award>;

  addOwner = this.sendRequest(WEN_FUNC.addOwnerAward)<AwardAddOwnerRequest, Award>;

  participate = this.sendRequest(WEN_FUNC.participateAward)<
    AwardParticpateRequest,
    AwardParticipant
  >;

  approveParticipant = this.sendRequest(WEN_FUNC.approveParticipantAward)<
    AwardApproveParticipantRequest,
    AwardApproveParticipantResponse
  >;

  cancel = this.sendRequest(WEN_FUNC.cancelAward)<AwardCancelRequest, Award>;

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
}
