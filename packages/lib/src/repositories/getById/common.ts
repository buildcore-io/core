import { PublicCollections, PublicSubCollections } from '@build-5/interfaces';
import { Build5Env } from '../../Config';

export const BATCH_MAX_SIZE = 100;
export const BATCH_TIMEOUT = 200;

export abstract class AbstractGetByIdGrouped {
  protected requests: { [key: string]: string[] } = {};
  protected requestCounter: { [key: string]: number } = {};
  protected timer: { [key: string]: Promise<void> | null } = {};

  constructor(
    protected readonly env: Build5Env,
    protected readonly col: PublicCollections,
    protected readonly subCol?: PublicSubCollections,
  ) {}

  protected init = (uid: string, parent: string) => {
    if (!this.requests[parent]) {
      this.requests[parent] = [];
    }
    if (!this.requestCounter[parent]) {
      this.requestCounter[parent] = 0;
    }

    if (!this.requests[parent].includes(uid)) {
      this.requests[parent].push(uid);
      this.requestCounter[parent]++;
    }
  };

  protected executeTimed = async (parent: string) => {
    if (!this.timer[parent]) {
      this.timer[parent] = new Promise<void>((resolve) =>
        setTimeout(async () => {
          await this.executeRequests(parent);
          resolve();
        }, BATCH_TIMEOUT),
      );
    }
    await this.timer[parent];
    this.timer[parent] = null;
  };

  protected executeRequests = async (_parent: string): Promise<void> => {
    throw new Error('Method not implemented.');
  };
}
