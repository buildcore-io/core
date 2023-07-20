import { GetTopMilestonesResponse, PublicCollections } from '@build-5/interfaces';
import { Observable } from 'rxjs';
import { Build5Env, getTopMilestonesUrl } from '../Config';
import { getSession } from '../Session';
import { toQueryParams } from '../fetch.utils';
import { fetchLive } from '../observable';
import { CrudRepository } from './CrudRepository';

export class MilestoneRepository extends CrudRepository<Record<string, unknown>> {
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.MILESTONE);
  }

  public getTopMilestonesLive = (): Observable<GetTopMilestonesResponse> => {
    const sessionId = getSession(this.env).sessionId;
    const url = getTopMilestonesUrl(this.env) + toQueryParams({ sessionId });
    return fetchLive(this.env, url);
  };
}
