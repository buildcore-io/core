import { ApiRoutes, Dataset, Subset } from '@buildcore/interfaces';
import { set } from 'lodash';
import { Buildcore } from '..';

export const BATCH_MAX_SIZE = 100;
export const BATCH_TIMEOUT = 500;

export interface Request {
  dataset: Dataset;
  setId: string;
  subset?: Subset;
  subsetId?: string;
  origin: Buildcore;
  apiKey: string;
}

export interface CreateUrlResponse {
  requests: Request[];
  url: string;
  params: Record<string, unknown>;
}

export abstract class AbstractGroupedGet {
  protected requests: Request[] = [];
  protected timer: Promise<void> | null = null;

  protected toKey = (r: Request) => r.dataset + r.setId + r.subset + r.subsetId;

  protected init = (request: Request) => {
    const existing = this.requests.find((r) => this.toKey(r) === this.toKey(request));
    if (!existing) {
      this.requests.push(request);
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

  protected groupRequests = () => {
    const requests = this.requests.splice(0);
    const remainin: Request[] = [];
    const result = requests.reduce(
      (acc, act) => {
        const key = act.origin + act.apiKey + act.dataset + act.subset;
        const current = acc[key] || [];
        if (current.length < BATCH_MAX_SIZE) {
          current.push(act);
        }
        return { ...acc, [key]: current };
      },
      {} as { [key: string]: Request[] },
    );
    this.requests.push(...remainin);
    return result;
  };

  protected createUrl = (): CreateUrlResponse[] => {
    throw new Error('Method not implemented.');
  };

  protected executeRequests = async (): Promise<void> => {
    throw new Error('Method not implemented.');
  };
}

export abstract class AbstractGetByIdGrouped extends AbstractGroupedGet {
  protected createUrl = () =>
    Object.values(this.groupRequests()).map((r) => {
      const params = {
        dataset: r[0].dataset,
        setIds: r.map((r) => r.setId),
      };
      if (r[0].subset) {
        const subsetIds = r.map((r) => r.subsetId);
        set(params, 'subsetIds', subsetIds);
        set(params, 'subset', r[0].subset);
      }

      const url = r[0].origin + ApiRoutes.GET_MANY_BY_ID;
      return { requests: r, url, params } as CreateUrlResponse;
    });
}
