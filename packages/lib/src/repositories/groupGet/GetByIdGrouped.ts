import { get } from 'lodash';
import { wrappedFetch } from '../../fetch.utils';
import { AbstractGetByIdGrouped, BATCH_MAX_SIZE } from './common';

export class GetByIdGrouped<T> extends AbstractGetByIdGrouped {
  private result: { [key: string]: T | undefined } = {};

  public get = async (uid: string, parent = ''): Promise<T | undefined> => {
    this.init(uid, parent);

    if (this.requestCounter === BATCH_MAX_SIZE) {
      await this.executeRequests();
      return this.result[parent + uid]!;
    }

    await this.executeTimed();
    return this.result[parent + uid]!;
  };

  protected executeRequests = async () => {
    const { url, requests, params } = this.createUrl();
    if (!requests.length) {
      return;
    }
    const response = await wrappedFetch<T[]>(url, params);
    const source = Array.isArray(response) ? response : [response];
    for (const r of requests) {
      this.result[r.parent + r.uid] = source.find((d) =>
        [get(d, 'uid', ''), get(d, 'id', '')].includes(r.uid),
      );
    }
  };
}
