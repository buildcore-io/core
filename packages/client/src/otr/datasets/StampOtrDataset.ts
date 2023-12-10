import { StampTangleRequest, TangleRequestType } from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

export class StamptOtrDataset extends DatasetClass {
  stamp = (uri: string, aliasId?: string) =>
    new OtrRequest<StampTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.STAMP,
      uri,
      aliasId,
    });
}
