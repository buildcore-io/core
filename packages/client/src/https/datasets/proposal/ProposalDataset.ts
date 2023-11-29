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
import { ProposalFilter } from '../..';
import { DatasetClass } from '../Dataset';

export class ProposalDataset<D extends Dataset> extends DatasetClass<D, Proposal> {
  create = this.sendRequest(WEN_FUNC.createProposal)<ProposalCreateRequest>;

  approve = this.sendRequest(WEN_FUNC.approveProposal)<ApproveProposalRequest>;

  reject = this.sendRequest(WEN_FUNC.rejectProposal)<RejectProposalRequest>;

  vote = this.sendRequest(WEN_FUNC.voteOnProposal)<ProposalVoteRequest>;

  getActiveLive = (startAfter?: string) => {
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

  getBySpaceAndFilterLive = (
    space: string,
    filter: ProposalFilter = ProposalFilter.ALL,
    startAfter?: string,
  ) => {
    const fieldName = ['space'];
    const fieldValue: (string | boolean)[] = [space];
    const operator = [Opr.EQUAL];
    const orderBy: string[] = [];
    const orderByDir: string[] = [];

    switch (filter) {
      case ProposalFilter.ACTIVE: {
        fieldName.push('settings.endDate', 'approved');
        fieldValue.push(new Date().toISOString(), true);
        operator.push(Opr.GREATER_OR_EQUAL, Opr.EQUAL);
        orderBy.push('settings.endDate');
        orderByDir.push('asc');
        break;
      }
      case ProposalFilter.COMPLETED: {
        fieldName.push('settings.endDate', 'approved');
        fieldValue.push(new Date().toISOString(), true);
        operator.push(Opr.LESS_OR_EQUAL, Opr.EQUAL);
        orderBy.push('settings.endDate');
        orderByDir.push('asc');
        break;
      }
      case ProposalFilter.DRAFT: {
        fieldName.push('rejected', 'approved');
        fieldValue.push(false, false);
        operator.push(Opr.EQUAL, Opr.EQUAL);
        break;
      }
      case ProposalFilter.REJECTED: {
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
      startAfter,
      orderBy,
      orderByDir,
    };
    return this.getManyAdvancedLive(params);
  };
}
