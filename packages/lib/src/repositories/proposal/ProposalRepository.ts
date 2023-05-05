import { Opr, Proposal, PublicCollections } from '@soonaverse/interfaces';
import { SoonEnv } from '../../Config';
import { CrudRepository } from '../CrudRepository';
import { ProposalFilter } from './intex';

export class ProposalRepository extends CrudRepository<Proposal> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.PROPOSAL);
  }

  public getActiveLive = (startAfter?: string) => {
    const params = {
      collection: this.col,
      fieldName: ['settings.endDate', 'approved'],
      fieldValue: [new Date().toISOString(), true],
      operator: [Opr.GREATER_OR_EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['settings.endDate'],
      orderByDir: ['asc'],
    };
    return this.getManyAdvancedLive(params);
  };

  public getBySpaceAndFilterLive = (
    space: string,
    filter: ProposalFilter = ProposalFilter.ALL,
    startAfter?: string,
  ) => {
    const fieldName = ['space'];
    const fieldValue: (string | boolean)[] = [space];
    const operator = [Opr.EQUAL];

    switch (filter) {
      case ProposalFilter.ACTIVE: {
        fieldName.push('settings.endDate', 'approve');
        fieldValue.push(new Date().toISOString(), true);
        operator.push(Opr.GREATER_OR_EQUAL, Opr.EQUAL);
        break;
      }
      case ProposalFilter.COMPLETED: {
        fieldName.push('settings.endDate', 'approve');
        fieldValue.push(new Date().toISOString(), true);
        operator.push(Opr.LESS_OR_EQUAL, Opr.EQUAL);
        break;
      }
      case ProposalFilter.DRAFT: {
        fieldName.push('rejected', 'approve');
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

    const params = {
      collection: this.col,
      fieldName,
      fieldValue,
      operator,
      startAfter,
      orderBy: ['settings.endDate'],
      orderByDir: ['asc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
