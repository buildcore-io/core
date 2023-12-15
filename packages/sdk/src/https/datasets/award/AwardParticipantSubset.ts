import { AwardParticipant, GetManyAdvancedRequest, Opr } from '@build-5/interfaces';
import { SubsetClass } from '../Subset';

export class AwardParticpateSubset extends SubsetClass<AwardParticipant> {
  getParticipantsLive = (
    award: string,
    completed: boolean,
    searchIds: string[] = [],
    startAfter?: string,
  ) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      setId: award,
      subset: this.subset,
      fieldName: searchIds.map(() => 'uid').concat('completed'),
      fieldValue: (searchIds as (string | boolean)[]).concat(completed),
      operator: searchIds.map(() => Opr.IN).concat(Opr.EQUAL),
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  getTopByMemberLive = (member: string, completed = true, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      subset: this.subset,
      fieldName: ['uid', 'parentCol', 'completed'],
      fieldValue: [member, this.dataset, completed],
      operator: [Opr.EQUAL, Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
