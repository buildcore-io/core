import { PublicCollections, PublicSubCollections } from '@build-5/interfaces';
import { set } from 'lodash';
import { Build5Env, getManyByIdUrl } from '../../Config';

export const BATCH_MAX_SIZE = 100;
export const BATCH_TIMEOUT = 200;

interface Request {
  parent: string;
  uid: string;
}

export abstract class AbstractGetByIdGrouped {
  protected requests: Request[] = [];
  protected requestCounter = 0;
  protected timer: Promise<void> | null = null;

  constructor(
    protected readonly env: Build5Env,
    protected readonly col: PublicCollections,
    protected readonly subCol?: PublicSubCollections,
  ) {}

  protected init = (uid: string, parent: string) => {
    const request = this.requests.find((r) => r.parent === parent && r.uid === uid);
    if (!request) {
      this.requests.push({ parent, uid });
      this.requestCounter++;
    }
  };

  protected executeTimed = async () => {
    if (!this.timer) {
      this.timer = new Promise<void>((resolve) =>
        setTimeout(async () => {
          await this.executeRequests();
          resolve();
        }, BATCH_TIMEOUT),
      );
    }
    await this.timer;
    this.timer = null;
  };

  protected createUrl = (sessionId?: string) => {
    const requests = this.requests.splice(0, BATCH_MAX_SIZE);
    this.requestCounter = Math.max(this.requestCounter - BATCH_MAX_SIZE, 0);

    const params = {
      collection: this.col,
      uids: requests.map((r) => r.uid),
    };
    if (sessionId) {
      set(params, 'sessionId', sessionId);
    }
    if (this.subCol) {
      const parents = requests.map((r) => r.parent);
      set(params, 'parentUids', parents);
      set(params, 'subCollection', this.subCol);
    }

    const url = getManyByIdUrl(this.env);
    return { requests, url, params };
  };

  protected executeRequests = async (): Promise<void> => {
    throw new Error('Method not implemented.');
  };
}
