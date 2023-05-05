import { Award, Opr, PublicCollections } from '@soonaverse/interfaces';
import { SoonEnv } from '../../Config';
import { CrudRepository } from '../CrudRepository';
import { AwardFilter } from './index';

export class AwardRepository extends CrudRepository<Award> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.AWARD);
  }

  public getBySpaceAndFilterLive = (space: string, filter: AwardFilter = AwardFilter.ALL) => {
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

    const params = { collection: this.col, fieldName, fieldValue, operator };
    return this.getManyAdvancedLive(params);
  };

  public getLastActiveLive = (startAfter?: string) => {
    const fieldName = ['endDate', 'completed', 'approved'];
    const fieldValue = [new Date().toISOString(), false, true];
    const operator = [Opr.GREATER_OR_EQUAL, Opr.EQUAL, Opr.EQUAL];
    const orderBy = ['endDate'];
    const params = { collection: this.col, fieldName, fieldValue, operator, startAfter, orderBy };
    return this.getManyAdvancedLive(params);
  };
}
