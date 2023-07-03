import { get } from 'lodash';
import { getManyByIdUrl } from '../../Config';
import { wrappedFetch } from '../../fetch.utils';
import { AbstractGetByIdGrouped, BATCH_MAX_SIZE } from './common';

export class GetByIdGrouped<T> extends AbstractGetByIdGrouped {
  private result: { [key: string]: T | undefined } = {};

  public get = async (uid: string, parent = 'static') => {
    this.init(uid, parent);

    if (this.requestCounter[parent] === BATCH_MAX_SIZE) {
      await this.executeRequests(parent);
      return this.result[parent + uid]!;
    }

    await this.executeTimed(parent);
    return this.result[parent + uid]!;
  };

  protected executeRequests = async (parent: string) => {
    const uids = this.requests[parent].splice(0, BATCH_MAX_SIZE);
    this.requestCounter[parent] = Math.max(this.requestCounter[parent] - BATCH_MAX_SIZE, 0);

    const params = this.subCol
      ? { collection: this.col, parentUid: parent, subCollection: this.subCol, uids }
      : { collection: this.col, uids };
    const source = await wrappedFetch<T[]>(getManyByIdUrl(this.env), params);
    for (const uid of uids) {
      this.result[parent + uid] = source.find((d) => get(d, 'uid', '') === uid);
    }
  };
}
