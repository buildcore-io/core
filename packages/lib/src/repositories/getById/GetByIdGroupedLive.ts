import { get } from 'lodash';
import { Observable, map } from 'rxjs';
import { SESSION_ID, getManyByIdUrl } from '../../Config';
import { toQueryParams } from '../../fetch.utils';
import { fetchLive } from '../../observable';
import { AbstractGetByIdGrouped, BATCH_MAX_SIZE } from './common';

export class GetByIdGroupedLive<T> extends AbstractGetByIdGrouped {
  private observers: { [key: string]: Observable<T | undefined> } = {};

  public get = async (uid: string, parent = 'static') => {
    this.init(uid, parent);

    if (this.observers[parent + uid]) {
      return this.observers[parent + uid]!;
    }

    if (this.requestCounter[parent] === BATCH_MAX_SIZE) {
      await this.executeRequests(parent);
      return this.observers[parent + uid]!;
    }

    await this.executeTimed(parent);
    return this.observers[parent + uid]!;
  };

  protected executeRequests = async (parent: string) => {
    const uids = this.requests[parent].splice(0, BATCH_MAX_SIZE);
    this.requestCounter[parent] = Math.max(this.requestCounter[parent] - BATCH_MAX_SIZE, 0);

    const params = this.subCol
      ? {
          collection: this.col,
          parentUid: parent,
          subCollection: this.subCol,
          uids,
          sessionId: SESSION_ID,
        }
      : { collection: this.col, uids, sessionId: SESSION_ID };
    const url = getManyByIdUrl(this.env) + toQueryParams({ ...params });
    const source = fetchLive<T[]>(this.env, url);
    for (const uid of uids) {
      this.observers[parent + uid] = source.pipe(
        map((s) => s.find((d) => get(d, 'uid', '') === uid)),
      );
    }
  };
}
