import {
  BuildcoreRequest,
  Dataset,
  Stamp,
  StampRequest,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { DatasetClass } from './Dataset';

/**
 * Stamp Dataset
 */
export class StampDataset<D extends Dataset> extends DatasetClass<D, Stamp> {
  /**
   * Stamping API.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link StampRequest}
   * @returns
   */
  stamp = (req: BuildcoreRequest<StampRequest>) =>
    this.sendRequest(WEN_FUNC.stamp)<StampRequest, Transaction>(req);
}
