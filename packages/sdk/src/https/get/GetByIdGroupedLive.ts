import { API_RETRY_TIMEOUT } from '@build-5/interfaces';
import { flatten, get } from 'lodash';
import { Observable, map } from 'rxjs';
import { toQueryParams } from '../fetch.utils';
import { AbstractGetByIdGrouped, BATCH_MAX_SIZE, Request } from './common';
import { fetchLive } from './observable';

export class GetByIdGroupedLiveClass extends AbstractGetByIdGrouped {
  private observers: { [key: string]: Observable<unknown | undefined> } = {};

  get = async <T>(request: Request): Promise<Observable<T | undefined>> => {
    this.init(request);

    if (this.requests.length >= BATCH_MAX_SIZE) {
      await this.executeRequests();
      return this.observers[request.setId + request.subsetId]! as Observable<T | undefined>;
    }

    await this.executeTimed();
    return this.observers[request.setId + request.subsetId]! as Observable<T | undefined>;
  };

  protected executeRequests = async () => {
    const promises = this.createUrl().map(async ({ requests, url, params }) => {
      try {
        const apiKey = requests[0].apiKey;
        const source = fetchLive(apiKey, url + toQueryParams(params)).pipe(
          map((r) => (Array.isArray(r) ? r : [r])),
        );
        for (const r of requests) {
          this.observers[r.setId + r.subsetId] = source.pipe(
            map((s) => {
              const id = r.subsetId || r.setId;
              return s.find((d) => [get(d, 'uid', ''), get(d, 'id', '')].includes(id));
            }),
          );
        }
        return [];
      } catch {
        await new Promise((resolve) => setTimeout(resolve, API_RETRY_TIMEOUT));
        return requests;
      }
    });
    this.requests.push(...flatten(await Promise.all(promises)));
  };
}

const GetByIdGroupedLive = new GetByIdGroupedLiveClass();
export default GetByIdGroupedLive;
