import {
  Award,
  AwardAddOwnerRequest,
  AwardApproveParticipantRequest,
  AwardCancelRequest,
  AwardCreateRequest,
  AwardFundRequest,
  AwardParticpateRequest,
  AwardRejectRequest,
  Dataset,
  GetManyAdvancedRequest,
  Opr,
  WEN_FUNC,
} from '@build-5/interfaces';
import { AwardFilter } from '../..';
import { DatasetClass } from '../Dataset';

export class AwardDataset<D extends Dataset> extends DatasetClass<D, Award> {
  create = this.sendRequest(WEN_FUNC.createAward)<AwardCreateRequest>;

  fund = this.sendRequest(WEN_FUNC.fundAward)<AwardFundRequest>;

  rejec = this.sendRequest(WEN_FUNC.rejectAward)<AwardRejectRequest>;

  addOwner = this.sendRequest(WEN_FUNC.addOwnerAward)<AwardAddOwnerRequest>;

  participate = this.sendRequest(WEN_FUNC.participateAward)<AwardParticpateRequest>;

  approveParticipant = this.sendRequest(
    WEN_FUNC.approveParticipantAward,
  )<AwardApproveParticipantRequest>;

  cancel = this.sendRequest(WEN_FUNC.cancelAward)<AwardCancelRequest>;

  getBySpaceAndFilterLive = (space: string, filter = AwardFilter.ALL) => {
    const fieldName = ['space'];
    const fieldValue: (string | number | boolean)[] = [space];
    const operator: Opr[] = [Opr.EQUAL];

    switch (filter) {
      case AwardFilter.ACTIVE: {
        fieldName.push('endDate', 'completed', 'approved');
        fieldValue.push(new Date().toISOString(), false, true);
        operator.push(Opr.GREATER_OR_EQUAL, Opr.EQUAL, Opr.EQUAL);
        break;
      }
      case AwardFilter.COMPLETED: {
        fieldName.push('completed', 'approved');
        fieldValue.push(true, true);
        operator.push(Opr.EQUAL, Opr.EQUAL);
        break;
      }
      case AwardFilter.DRAFT: {
        fieldName.push('endDate', 'rejected', 'approved');
        fieldValue.push(new Date().toISOString(), false, false);
        operator.push(Opr.GREATER_OR_EQUAL, Opr.EQUAL, Opr.EQUAL);
        break;
      }
      case AwardFilter.REJECTED: {
        fieldName.push('rejected');
        fieldValue.push(true);
        operator.push(Opr.EQUAL);
        break;
      }
    }

    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName,
      fieldValue,
      operator,
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
