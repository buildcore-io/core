import { AwardParticipant, Opr, PublicCollections, PublicSubCollections } from '@build-5/interfaces';
import { SoonEnv } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class AwardParticipantRepository extends SubCrudRepository<AwardParticipant> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.AWARD, PublicSubCollections.PARTICIPANTS);
  }

  public getParticipantsLive = (
    award: string,
    completed: boolean,
    searchIds: string[] = [],
    startAfter?: string,
  ) => {
    const params = {
      collection: this.col,
      uid: award,
      subCollection: this.subCol,
      fieldName: searchIds.map(() => 'uid').concat('completed'),
      fieldValue: (searchIds as (string | boolean)[]).concat(completed),
      operator: searchIds.map(() => Opr.IN).concat(Opr.EQUAL),
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  public getTopByMemberLive = (member: string, completed = true, startAfter?: string) => {
    const params = {
      collection: this.col,
      subCollection: this.subCol,
      fieldName: ['uid', 'parentCol', 'completed'],
      fieldValue: [member, this.col, completed],
      operator: [Opr.EQUAL, Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
