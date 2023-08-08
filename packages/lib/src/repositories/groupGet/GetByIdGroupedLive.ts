import { get } from 'lodash';
import { Observable, map } from 'rxjs';
import { getSessionId } from '../../Session';
import { toQueryParams } from '../../fetch.utils';
import { fetchLive } from '../../observable';
import { AbstractGetByIdGrouped, BATCH_MAX_SIZE } from './common';

export class GetByIdGroupedLive<T> extends AbstractGetByIdGrouped {
  private observers: { [key: string]: Observable<T | undefined> } = {};

  public get = async (uid: string, parent = '') => {
    this.init(uid, parent);

    if (this.requests.length >= BATCH_MAX_SIZE) {
      await this.executeRequests();
      return this.observers[parent + uid]!;
    }

    await this.executeTimed();
    return this.observers[parent + uid]!;
  };

  protected executeRequests = async () => {
    const { url, requests, params } = this.createUrl(getSessionId(this.env));
    if (!requests.length) {
      return;
    }
    try {
      const source = fetchLive<T[]>(this.env, url + toQueryParams(params)).pipe(
        map((r) => (Array.isArray(r) ? r : [r])),
      );
      for (const r of requests) {
        this.observers[r.parent + r.uid] = source.pipe(
          map((s) => s.find((d) => [get(d, 'uid', ''), get(d, 'id', '')].includes(r.uid))),
        );
      }
    } catch {
      this.requests.push(...requests);
    }
  };
}
