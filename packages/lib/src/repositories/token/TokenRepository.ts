import { Opr, PublicCollections, Token, TokenStatus } from '@soonaverse/interfaces';
import { SoonEnv } from '../../Config';
import { CrudRepository } from '../CrudRepository';

export class TokenRepository extends CrudRepository<Token> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.TOKEN);
  }

  public getByMemberLive = (member: string, startAfter?: string) => {
    const params = {
      collection: this.col,
      fieldName: ['member'],
      fieldValue: [member],
      operator: [Opr.EQUAL],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  public getLatestLive = (startAfter?: string) => {
    const params = {
      collection: this.col,
      startAfter,
      fieldName: [],
      fieldValue: [],
      operator: [],
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  public getByStatusLive = (status: TokenStatus[] = [], startAfter?: string) => {
    const params = {
      collection: this.col,
      fieldName: status.map(() => 'status').concat('public'),
      fieldValue: (status as (string | boolean)[]).concat(true),
      operator: status.map(() => Opr.EQUAL).concat(Opr.EQUAL),
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
