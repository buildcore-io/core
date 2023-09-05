import { PublicCollections, PublicSubCollections } from '@build-5/interfaces';
import { set } from 'lodash';
import { Build5Env, getManyByIdUrl } from '../../Config';

export const BATCH_MAX_SIZE = 100;
export const BATCH_TIMEOUT = 500;

interface Request {
  parent: string;
  uid: string;
}

export interface CreateUrlResponse {
  requests: Request[];
  url: string;
  params: Record<string, unknown>;
}

export abstract class AbstractGroupedGet {
  protected requests: Request[] = [];
  protected timer: Promise<void> | null = null;

  constructor(
    protected readonly env: Build5Env,
    protected readonly col: PublicCollections,
    protected readonly subCol?: PublicSubCollections,
  ) {}

  protected init = (uid: string, parent = '') => {
    const request = this.requests.find((r) => r.parent === parent && r.uid === uid);
    if (!request) {
      this.requests.push({ parent, uid });
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

  protected createUrl = (): CreateUrlResponse => {
    throw new Error('Method not implemented.');
  };

  protected executeRequests = async (): Promise<void> => {
    throw new Error('Method not implemented.');
  };
}

export abstract class AbstractGetByIdGrouped extends AbstractGroupedGet {
  protected createUrl = () => {
    const requests = this.requests.splice(0, BATCH_MAX_SIZE);

    const params = {
      collection: this.col,
      uids: requests.map((r) => r.uid),
    };
    if (this.subCol) {
      const parents = requests.map((r) => r.parent);
      set(params, 'parentUids', parents);
      set(params, 'subCollection', this.subCol);
    }

    const url = getManyByIdUrl(this.env);
    return { requests, url, params } as CreateUrlResponse;
  };
}
