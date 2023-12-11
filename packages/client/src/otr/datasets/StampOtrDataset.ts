import { StampTangleRequest, TangleRequestType } from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

export class StamptOtrDataset extends DatasetClass {
  stamp = (params: Omit<StampTangleRequest, 'requestType'>) =>
    new OtrRequest<StampTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.STAMP,
    });
}
