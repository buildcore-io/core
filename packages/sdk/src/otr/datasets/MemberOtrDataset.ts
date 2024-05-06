import { AddressValidationTangleRequest, TangleRequestType } from '@buildcore/interfaces';
import { DatasetClass, OtrRequest } from './common';

/**
 * Member OTR Dataset
 */
export class MemberOtrDataset extends DatasetClass {
  /**
   * Validate Address on the Member
   *
   * @param params Use {@link OtrRequest} with data based on {@link AddressValidationTangleRequest}
   * @returns
   */
  validateAddress = () =>
    new OtrRequest<AddressValidationTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.ADDRESS_VALIDATION,
    });
}
