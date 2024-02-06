import { StampTangleRequest, TangleRequestType } from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

/**
 * Stamp OTR Dataset
 */
export class StamptOtrDataset extends DatasetClass {
  /**
   * Stamp file via OTR
   *
   * @param params Use {@link OtrRequest} with data based on {@link StampTangleRequest}
   * @returns
   */
  stamp = (params: Omit<StampTangleRequest, 'requestType'>) =>
    new OtrRequest<StampTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.STAMP,
    });
}
