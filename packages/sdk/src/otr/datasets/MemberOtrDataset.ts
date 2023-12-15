import { AddressValidationTangleRequest, TangleRequestType } from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

export class MemberOtrDataset extends DatasetClass {
  validateAddress = () =>
    new OtrRequest<AddressValidationTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.ADDRESS_VALIDATION,
    });
}
