import {
  Build5Request,
  Dataset,
  Stamp,
  StampRequest,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

/**
 * Stamp Dataset
 */
export class StampDataset<D extends Dataset> extends DatasetClass<D, Stamp> {
  /**
   * Stamping API.
   *
   * @param req Use {@link Build5Request} with data based on {@link StampRequest}
   * @returns
   */
  stamp = (req: Build5Request<StampRequest>) =>
    this.sendRequest(WEN_FUNC.stamp)<StampRequest, Transaction>(req);
}
