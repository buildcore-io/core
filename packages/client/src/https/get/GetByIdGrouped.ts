import { API_RETRY_TIMEOUT } from '@build-5/interfaces';
import { flatten, get } from 'lodash';
import { API_KEY } from '..';
import { wrappedFetch } from '../fetch.utils';
import { AbstractGetByIdGrouped, BATCH_MAX_SIZE, Request } from './common';

export class GetByIdGroupedClass extends AbstractGetByIdGrouped {
  private result: { [key: string]: unknown } = {};

  get = async <T>(request: Request): Promise<T | undefined> => {
    this.init(request);

    if (this.requests.length >= BATCH_MAX_SIZE) {
      await this.executeRequests();
      return this.result[request.setId + request.subsetId]! as T | undefined;
    }

    await this.executeTimed();
    return this.result[request.setId + request.subsetId]! as T | undefined;
  };

  protected executeRequests = async () => {
    const promises = this.createUrl().map(async ({ requests, url, params }) => {
      try {
        const apiKey = API_KEY[requests[0].origin];
        const response = await wrappedFetch(apiKey, url, params);
        const source = Array.isArray(response) ? response : [response];
        for (const r of requests) {
          this.result[r.setId + r.subsetId] = source.find((d) =>
            [get(d, 'uid', ''), get(d, 'id', '')].includes(r.subsetId || r.setId),
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

const GetByIdGrouped = new GetByIdGroupedClass();

export default GetByIdGrouped;
